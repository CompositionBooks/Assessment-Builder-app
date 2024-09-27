import { LightningElement, track, api } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import getQuestions from '@salesforce/apex/QuestionBuilderController.getQuestions';
import updateQuestionSequences from '@salesforce/apex/QuestionBuilderController.updateQuestionSequences';
import deleteQuestion from '@salesforce/apex/QuestionBuilderController.deleteQuestion';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import SORTABLEJS from '@salesforce/resourceUrl/SortableJS';

export default class QuestionBuilder extends LightningElement {
    @api recordId;
    @track questions = [];
    @track selectedQuestion = null;
    @track showModal = false;
    @track loading = false;
    @track error;
    sortableInitialized = false;
    isScriptLoaded = false;

    connectedCallback() {
        console.log('Connected callback: Loading questions');
        this.loadQuestions();
    }

    renderedCallback() {
        if (this.sortableInitialized) {
            return;
        }

        if (!this.isScriptLoaded) {
            loadScript(this, SORTABLEJS)
                .then(() => {
                    this.isScriptLoaded = true;
                    this.initializeSortable();
                })
                .catch(error => {
                    this.error = error;
                    console.error('Error loading SortableJS:', error);
                    this.showToast('Error loading SortableJS', error.message, 'error');
                });
        } else {
            this.initializeSortable();
        }
    }

    initializeSortable() {
        if (this.sortableInitialized) {
            return;
        }

        const el = this.template.querySelector('.question-list');
        if (el) {
            this.sortable = new Sortable(el, {
                handle: '.drag-handle',
                animation: 150,
                onEnd: this.handleDragEnd.bind(this)
            });
            this.sortableInitialized = true;
        }
    }

    loadQuestions() {
        this.loading = true;
        getQuestions({ templateId: this.recordId })
            .then(result => {
                console.log('Questions loaded:', result);
                this.questions = result.map((q, index) => {
                    let questionData = { ...q };
                    delete questionData.attributes;

                    const options = q.Question_Options__r ? q.Question_Options__r.map((opt, idx) => {
                        let optionData = { ...opt };
                        delete optionData.attributes;

                        const optKey = opt.Id || `${Date.now()}-${idx}`;
                        return {
                            ...optionData,
                            key: optKey,
                            buttonKey: `${optKey}-btn`
                        };
                    }) : [];

                    return {
                        ...questionData,
                        Sequence_Number__c: index + 1,
                        options: options
                    };
                });
                this.loading = false;
                this.initializeSortable();
            })
            .catch(error => {
                this.error = error;
                console.error('Error loading questions:', error);
                this.showToast('Error loading questions', this.getErrorMessage(error), 'error');
                this.loading = false;
            });
    }

    handleDragEnd(event) {
        const movedItem = this.questions.splice(event.oldIndex, 1)[0];
        this.questions.splice(event.newIndex, 0, movedItem);

        this.questions = this.questions.map((q, index) => {
            q.Sequence_Number__c = index + 1;
            return q;
        });

        updateQuestionSequences({ questions: this.questions })
            .then(() => {
                this.showToast('Success', 'Question order updated.', 'success');
            })
            .catch(error => {
                this.error = error;
                console.error('Error updating question sequences:', error);
                this.showToast('Error updating question order', this.getErrorMessage(error), 'error');
            });
    }

    handleNewQuestion() {
        console.log('New question triggered');
        this.selectedQuestion = {
            Id: null,
            Template__c: this.recordId,
            Question_Text__c: '',
            Question_Type__c: '',
            Is_Required__c: false,
            Sequence_Number__c: this.questions.length + 1,
            options: []
        };
        this.showModal = true;
    }

    handleEditQuestion(event) {
        const questionId = event.currentTarget.dataset.id;
        console.log('Edit question triggered for ID:', questionId);
        const question = this.questions.find(q => q.Id === questionId);
        let questionData = JSON.parse(JSON.stringify(question));
        delete questionData.attributes;
        if (questionData.options) {
            questionData.options = questionData.options.map(opt => {
                delete opt.attributes;
                return opt;
            });
        }
        this.selectedQuestion = questionData;
        this.showModal = true;
    }

    handleDeleteQuestion(event) {
        const questionId = event.currentTarget.dataset.id;
        LightningConfirm.open({
            message: 'Are you sure you want to delete this question?',
            variant: 'header',
            label: 'Confirm Delete',
            theme: 'warning'
        }).then((result) => {
            if (result) {
                deleteQuestion({ questionId })
                    .then(() => {
                        this.showToast('Success', 'Question deleted successfully.', 'success');
                        this.loadQuestions();
                    })
                    .catch(error => {
                        this.error = error;
                        console.error('Error deleting question:', error);
                        this.showToast('Error deleting question', this.getErrorMessage(error), 'error');
                    });
            }
        });
    }

    handleModalSave() {
        console.log('Save button clicked in modal');
        const modal = this.template.querySelector('c-question-edit-modal');
        if (modal) {
            console.log('Modal component found, calling handleSaveQuestion');
            modal.handleSaveQuestion();
        } else {
            console.error('Modal component not found');
        }
    }

    handleModalSuccess() {
        console.log('Modal save success');
        this.showModal = false;
        this.selectedQuestion = null;
        this.loadQuestions();
    }

    handleModalCancel() {
        console.log('Modal cancel clicked');
        this.showModal = false;
        this.selectedQuestion = null;
    }

    getErrorMessage(error) {
        let errorMessage = 'An unknown error occurred.';
        if (error) {
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
        }
        return errorMessage;
    }

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }

    get modalTitle() {
        return this.selectedQuestion && this.selectedQuestion.Id ? 'Edit Question' : 'New Question';
    }
}
