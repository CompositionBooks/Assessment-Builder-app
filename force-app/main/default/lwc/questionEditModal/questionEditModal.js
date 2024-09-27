import { LightningElement, api, track } from 'lwc';
import saveQuestionWithOptions from '@salesforce/apex/QuestionBuilderController.saveQuestionWithOptions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class QuestionEditModal extends LightningElement {
    @api question;
    @api recordId;

    @track selectedQuestion;
    @track isOptionType = false;
    @track defaultOptionChoices = [];
    @track selectedDefaultOption = '';

    questionTypeOptions = [
        { label: 'Single Line Text', value: 'Single Line Text' },
        { label: 'Paragraph Text', value: 'Paragraph Text' },
        { label: 'Picklist (Single Select)', value: 'Picklist (Single Select)' },
        { label: 'Multi-Select Picklist', value: 'Multi-Select Picklist' },
        { label: 'Checkboxes', value: 'Checkboxes' },
        { label: 'Radio Buttons', value: 'Radio Buttons' },
        { label: 'Date', value: 'Date' },
        { label: 'Number', value: 'Number' }
    ];

    connectedCallback() {
        console.log('Modal connected callback');
        this.selectedQuestion = JSON.parse(JSON.stringify(this.question));

        delete this.selectedQuestion.attributes;
        if (this.selectedQuestion.options) {
            this.selectedQuestion.options = this.selectedQuestion.options.map(opt => {
                delete opt.attributes;
                return opt;
            });
        }

        if (this.selectedQuestion.options) {
            this.selectedQuestion.options = this.selectedQuestion.options.map((opt, index) => {
                const optKey = opt.Id || `${Date.now()}-${index}`;
                return { ...opt, key: optKey, buttonKey: `${optKey}-btn` };
            });
        }

        this.isOptionType = ['Picklist (Single Select)', 'Multi-Select Picklist', 'Checkboxes', 'Radio Buttons'].includes(
            this.selectedQuestion.Question_Type__c
        );

        if (this.isOptionType) {
            this.prepareDefaultOptionChoices();
        }
    }

    handleInputChange(event) {
        const field = event.target.name;
        this.selectedQuestion[field] = event.target.value;
    }

    handleCheckboxChange(event) {
        const field = event.target.name;
        this.selectedQuestion[field] = event.target.checked;
    }

    handleQuestionTypeChange(event) {
        this.selectedQuestion.Question_Type__c = event.detail.value;
        this.isOptionType = ['Picklist (Single Select)', 'Multi-Select Picklist', 'Checkboxes', 'Radio Buttons'].includes(
            this.selectedQuestion.Question_Type__c
        );
        if (!this.isOptionType) {
            this.selectedQuestion.options = [];
            this.defaultOptionChoices = [];
            this.selectedDefaultOption = '';
        } else {
            this.prepareDefaultOptionChoices();
        }
    }

    handleOptionChange(event) {
        const key = event.currentTarget.dataset.key;
        const field = event.target.name;
        const option = this.selectedQuestion.options.find(opt => opt.key === key);
        if (option) {
            if (event.target.type === 'checkbox') {
                option[field] = event.target.checked;
            } else {
                option[field] = event.target.value;
            }
        }
        this.prepareDefaultOptionChoices();
    }

    handleDefaultOptionChange(event) {
        const selectedKey = event.detail.value;
        this.selectedDefaultOption = selectedKey;
        this.selectedQuestion.options.forEach(opt => {
            opt.Is_Default__c = (opt.key === selectedKey);
        });
    }

    handleAddOption() {
        const newKey = `${Date.now()}-${this.selectedQuestion.options.length}`;
        this.selectedQuestion.options.push({
            Id: null,
            Value__c: '',
            Is_Active__c: true,
            Is_Default__c: false,
            Sequence_Number__c: this.selectedQuestion.options.length + 1,
            key: newKey,
            buttonKey: `${newKey}-btn`
        });
        this.prepareDefaultOptionChoices();
    }

    handleDeleteOption(event) {
        const key = event.currentTarget.dataset.key;
        this.selectedQuestion.options = this.selectedQuestion.options.filter(opt => opt.key !== key);
        this.prepareDefaultOptionChoices();
    }

    prepareDefaultOptionChoices() {
        if (this.selectedQuestion.options) {
            this.defaultOptionChoices = this.selectedQuestion.options.map(opt => {
                return {
                    label: opt.Value__c,
                    value: opt.key
                };
            });

            const defaultOption = this.selectedQuestion.options.find(opt => opt.Is_Default__c);
            if (defaultOption) {
                this.selectedDefaultOption = defaultOption.key;
            } else {
                this.selectedDefaultOption = '';
            }
        } else {
            this.defaultOptionChoices = [];
            this.selectedDefaultOption = '';
        }
    }

    @api
    handleSaveQuestion() {
        console.log('handleSaveQuestion called in questionEditModal');
        console.log('Selected question data:', this.selectedQuestion);

        if (!this.selectedQuestion.Question_Text__c || !this.selectedQuestion.Question_Type__c) {
            this.showToast('Error', 'Please complete all required fields.', 'error');
            return;
        }

        const question = {
            Id: this.selectedQuestion.Id,
            Template__c: this.recordId,
            Question_Text__c: this.selectedQuestion.Question_Text__c,
            Question_Type__c: this.selectedQuestion.Question_Type__c,
            Is_Required__c: this.selectedQuestion.Is_Required__c,
            Sequence_Number__c: this.selectedQuestion.Sequence_Number__c
        };

        const options = this.isOptionType && this.selectedQuestion.options.length > 0
            ? this.selectedQuestion.options.map(opt => ({
                Id: opt.Id,
                Value__c: opt.Value__c,
                Is_Active__c: opt.Is_Active__c,
                Is_Default__c: opt.Is_Default__c,
                Sequence_Number__c: opt.Sequence_Number__c
            }))
            : null;

        console.log('Sending data to Apex:', question, options);
        saveQuestionWithOptions({ question, options })
            .then(() => {
                console.log('Question saved successfully');
                this.showToast('Success', 'Question saved successfully.', 'success');
                const successEvent = new CustomEvent('success');
                this.dispatchEvent(successEvent);
            })
            .catch(error => {
                console.error('Error saving question:', error);
                this.showToast('Error saving question', this.getErrorMessage(error), 'error');
            });
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
}