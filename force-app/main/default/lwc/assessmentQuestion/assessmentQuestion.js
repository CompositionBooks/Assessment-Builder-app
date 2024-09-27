// assessmentQuestion.js
import { LightningElement, api } from 'lwc';

export default class AssessmentQuestion extends LightningElement {
    @api question;

    handleInputChange(event) {
        const questionId = this.question.Id;
        const questionType = this.question.Question_Type__c;
        let value;

        if (questionType === 'Checkboxes') {
            // For checkboxes, send the value and checked status
            value = {
                optionValue: event.target.value,
                checked: event.target.checked
            };
        } else if (questionType === 'Multi-Select Picklist') {
            // For multi-select picklists, get the array of selected values
            value = event.detail.value;
        } else {
            // For other input types, get the input value
            value = event.target.value;
        }

        // Prepare the detail object
        const detail = {
            questionId: questionId,
            value: value,
            questionType: questionType
        };

        // Dispatch the event to parent
        const valueChangeEvent = new CustomEvent('valuechange', {
            detail: detail,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(valueChangeEvent);
    }

    handleBlur(event) {
        const value = event.target.value;
        const questionId = this.question.Id;
        const questionType = this.question.Question_Type__c;

        // Prepare the detail object
        const detail = {
            questionId: questionId,
            value: value,
            questionType: questionType
        };

        // Dispatch the event to parent
        const valueChangeEvent = new CustomEvent('valuechange', {
            detail: detail,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(valueChangeEvent);
    }

    get isTextType() {
        return ['Single Line Text', 'Date', 'Number'].includes(this.question.Question_Type__c);
    }

    get isTextareaType() {
        return this.question.Question_Type__c === 'Paragraph Text';
    }

    get isPicklistType() {
        return this.question.Question_Type__c === 'Picklist (Single Select)';
    }

    get isMultiSelectPicklistType() {
        return this.question.Question_Type__c === 'Multi-Select Picklist';
    }

    get isCheckboxType() {
        return this.question.Question_Type__c === 'Checkboxes';
    }

    get isRadioButtonType() {
        return this.question.Question_Type__c === 'Radio Buttons';
    }

    get inputType() {
        const typeMap = {
            'Single Line Text': 'text',
            'Date': 'date',
            'Number': 'number'
        };
        return typeMap[this.question.Question_Type__c] || 'text';
    }

    isValid() {
        const input = this.template.querySelector(
            'lightning-input, lightning-textarea, lightning-combobox, lightning-dual-listbox, lightning-radio-group'
        );
        if (input) {
            input.reportValidity();
            return input.checkValidity();
        }
        return true;
    }
}
