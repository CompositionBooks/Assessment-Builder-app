// assessmentComponent.js
import { LightningElement, api, track, wire } from 'lwc';
import getAssessmentQuestionsAndResponses from '@salesforce/apex/AssessmentController.getAssessmentQuestionsAndResponses';
import saveAssessmentResponses from '@salesforce/apex/AssessmentController.saveAssessmentResponses';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { subscribe, MessageContext } from 'lightning/messageService';
import ASSESSMENTMC from '@salesforce/messageChannel/AssessmentMessageChannel__c';

export default class AssessmentComponent extends LightningElement {
    @api recordId;
    @api objectApiName;
    @api assessmentTemplateField;
    @track assessmentInstanceId;
    @track questions = [];
    @track responses = {};
    @track isLoading = false;
    @track error;

    subscription = null;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        console.log('assessmentComponent connectedCallback');
        this.subscribeToMessageChannel();
    }

    renderedCallback() {
        console.log('assessmentComponent renderedCallback');
    }

    subscribeToMessageChannel() {
        if (this.subscription) {
            return;
        }
        this.subscription = subscribe(
            this.messageContext,
            ASSESSMENTMC,
            (message) => this.handleMessage(message)
        );
    }

    handleMessage(message) {
        console.log('Received message:', message);
        this.assessmentInstanceId = message.instanceId;
        this.loadQuestionsAndResponses();
    }

    loadQuestionsAndResponses() {
        if (!this.assessmentInstanceId) {
            console.warn('No assessmentInstanceId provided');
            return;
        }

        console.log('Loading questions and responses for instanceId:', this.assessmentInstanceId);
        this.isLoading = true;
        getAssessmentQuestionsAndResponses({ instanceId: this.assessmentInstanceId })
            .then((result) => {
                console.log('Received questions and responses:', result);
                const responsesMap = result.responses || {};
                this.responses = { ...responsesMap };

                this.questions = result.questions.map((question) => {
                    const responseValue = responsesMap[question.Id] || null;
                    const responseValueArray = responseValue ? responseValue.split(';') : [];
                    const options = this.getOptions(question, responseValueArray);

                    return {
                        ...question,
                        isTextType: ['Single Line Text', 'Date', 'Number'].includes(question.Question_Type__c),
                        isTextareaType: question.Question_Type__c === 'Paragraph Text',
                        isPicklistType: question.Question_Type__c === 'Picklist (Single Select)',
                        isMultiSelectPicklistType: question.Question_Type__c === 'Multi-Select Picklist',
                        isCheckboxType: question.Question_Type__c === 'Checkboxes',
                        isRadioButtonType: question.Question_Type__c === 'Radio Buttons',
                        inputType: this.getInputType(question.Question_Type__c),
                        options: options,
                        responseValue: responseValue,
                        responseValueArray: responseValueArray
                    };
                });
                this.isLoading = false;
            })
            .catch((error) => {
                console.error('Error loading questions and responses:', error);
                this.error = error;
                this.showToast('Error', this.getErrorMessage(error), 'error');
                this.isLoading = false;
            });
    }

    getInputType(questionType) {
        const typeMap = {
            'Single Line Text': 'text',
            'Date': 'date',
            'Number': 'number'
        };
        return typeMap[questionType] || 'text';
    }

    getOptions(question, responseValueArray) {
        if (question.Question_Options__r) {
            return question.Question_Options__r.map((opt) => {
                return {
                    label: opt.Value__c,
                    value: opt.Value__c,
                    isSelected: responseValueArray.includes(opt.Value__c)
                };
            });
        }
        return [];
    }

    handleValueChange(event) {
        try {
            const detail = event.detail;
            const questionId = detail.questionId;
            const value = detail.value;
            const questionType = detail.questionType;

            console.log('Value changed:', { questionId, questionType, value });

            if (questionType === 'Checkboxes') {
                let selectedOptions = this.responses[questionId] ? this.responses[questionId].split(';') : [];
                const optionValue = value.optionValue;
                if (value.checked) {
                    if (!selectedOptions.includes(optionValue)) {
                        selectedOptions.push(optionValue);
                    }
                } else {
                    selectedOptions = selectedOptions.filter(opt => opt !== optionValue);
                }
                this.responses[questionId] = selectedOptions.join(';');
            } else if (questionType === 'Multi-Select Picklist') {
                this.responses[questionId] = value.join(';');
            } else {
                this.responses[questionId] = value;
            }
        } catch (error) {
            console.error('Error in handleValueChange:', error);
        }
    }

    handleSubmit() {
        console.log('handleSubmit method called');
    
        // Validate required fields
        const allValid = [
            ...this.template.querySelectorAll(
                'lightning-input, lightning-textarea, lightning-combobox, lightning-dual-listbox, lightning-radio-group'
            )
        ].reduce((validSoFar, inputCmp) => {
            inputCmp.reportValidity();
            return validSoFar && inputCmp.checkValidity();
        }, true);
        
        console.log('Validation result:', allValid);
    
        if (!allValid) {
            this.showToast('Error', 'Please complete all required fields.', 'error');
            return;
        }
    
        // Prepare response details
        const responseDetails = [];
    
        for (const question of this.questions) {
            const value = this.responses[question.Id];
            if (value !== undefined && value !== null && value !== '') {
                responseDetails.push({
                    Question__c: question.Id,
                    Response_Value__c: value,
                    Record_ID__c: this.recordId, // Include Record_ID__c
                    Object_API_Name__c: this.objectApiName // Include Object_API_Name__c
                });
            }
        }
    
        console.log('Responses to save:', JSON.stringify(responseDetails));
    
        // Save responses
        this.isLoading = true;
        saveAssessmentResponses({
            instanceId: this.assessmentInstanceId,
            responses: responseDetails
        })
            .then(() => {
                console.log('Responses saved successfully');
                this.showToast('Success', 'Assessment submitted successfully.', 'success');
                this.responses = {};
                this.loadQuestionsAndResponses();
            })
            .catch((error) => {
                console.error('Error saving responses:', JSON.stringify(error));
                this.error = error;
                this.showToast('Error', this.getErrorMessage(error), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
      

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }

    get errorMessage() {
        return this.getErrorMessage(this.error);
    }

    getErrorMessage(error) {
        let errorMessage = 'An unknown error occurred.';
        if (error) {
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.body && error.body.pageErrors && error.body.pageErrors.length > 0) {
                errorMessage = error.body.pageErrors[0].message;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
        }
        return errorMessage;
    }
}
