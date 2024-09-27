import { LightningElement, api, track } from "lwc";
import getAssessmentTemplateId from "@salesforce/apex/AssessmentController.getAssessmentTemplateId";
import getAssessmentQuestions from "@salesforce/apex/AssessmentController.getAssessmentQuestions";
import saveAssessmentResponse from "@salesforce/apex/AssessmentController.saveAssessmentResponse";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class AssessmentComponent extends LightningElement {
  @api recordId; // Current record Id
  @api objectApiName; // Current object API name
  @api assessmentTemplateField; // Assessment Template Lookup Field API Name
  @track assessmentTemplateId;
  @track questions = [];
  @track responses = {};
  @track isLoading = false;
  @track error;

  connectedCallback() {
    this.getAssessmentTemplateId();
  }

  getAssessmentTemplateId() {
    if (
      !this.recordId ||
      !this.objectApiName ||
      !this.assessmentTemplateField
    ) {
      this.showToast("Error", "Missing required properties.", "error");
      return;
    }
    getAssessmentTemplateId({
      recordId: this.recordId,
      objectApiName: this.objectApiName,
      fieldApiName: this.assessmentTemplateField
    })
      .then((result) => {
        this.assessmentTemplateId = result;
        if (this.assessmentTemplateId) {
          this.loadQuestions();
        } else {
          this.showToast(
            "Error",
            "No Assessment Template is associated with this record.",
            "error"
          );
        }
      })
      .catch((error) => {
        this.error = error;
        this.showToast("Error", this.getErrorMessage(error), "error");
      });
  }

  loadQuestions() {
    if (!this.assessmentTemplateId) {
      return;
    }

    this.isLoading = true;
    getAssessmentQuestions({ templateId: this.assessmentTemplateId })
      .then((result) => {
        // Process questions to add computed properties
        this.questions = result.map((question) => {
          return {
            ...question,
            isTextType: ["Single Line Text", "Date", "Number"].includes(
              question.Question_Type__c
            ),
            isTextareaType: question.Question_Type__c === "Paragraph Text",
            isPicklistType:
              question.Question_Type__c === "Picklist (Single Select)",
            isMultiSelectPicklistType:
              question.Question_Type__c === "Multi-Select Picklist",
            isCheckboxType: question.Question_Type__c === "Checkboxes",
            isRadioButtonType: question.Question_Type__c === "Radio Buttons",
            inputType: this.getInputType(question.Question_Type__c),
            options: this.getOptions(question)
          };
        });
        this.isLoading = false;
      })
      .catch((error) => {
        this.error = error;
        this.showToast("Error", this.getErrorMessage(error), "error");
        this.isLoading = false;
      });
  }

  getInputType(questionType) {
    const typeMap = {
      "Single Line Text": "text",
      Date: "date",
      Number: "number"
    };
    return typeMap[questionType] || "text";
  }

  getOptions(question) {
    if (question.Question_Options__r) {
      return question.Question_Options__r.map((opt) => {
        return {
          label: opt.Value__c,
          value: opt.Value__c
        };
      });
    }
    return [];
  }

  handleInputChange(event) {
    const questionId = event.target.dataset.questionId;
    const questionType = event.target.dataset.questionType;
    let value = event.target.value;

    if (questionType === "Checkboxes") {
      const selectedOptions = this.responses[questionId] || [];
      if (event.target.checked) {
        selectedOptions.push(value);
      } else {
        const index = selectedOptions.indexOf(value);
        if (index > -1) {
          selectedOptions.splice(index, 1);
        }
      }
      this.responses[questionId] = selectedOptions;
    } else if (questionType === "Multi-Select Picklist") {
      this.responses[questionId] = event.detail.value;
    } else {
      this.responses[questionId] = value;
    }
  }

  handleSubmit() {
    // Validate required fields
    const allValid = [
      ...this.template.querySelectorAll(
        "lightning-input, lightning-textarea, lightning-combobox, lightning-dual-listbox, lightning-radio-group"
      )
    ].reduce((validSoFar, inputCmp) => {
      inputCmp.reportValidity();
      return validSoFar && inputCmp.checkValidity();
    }, true);

    if (!allValid) {
      this.showToast("Error", "Please complete all required fields.", "error");
      return;
    }

    // Prepare data to save
    const response = {
      Record_ID__c: this.recordId,
      Object_API_Name__c: this.objectApiName,
      Assessment_Template__c: this.assessmentTemplateId
      // Add other necessary fields
    };

    const responseDetails = [];

    for (const question of this.questions) {
      const value = this.responses[question.Id];
      const detail = {
        Question__c: question.Id
      };

      if (value !== undefined && value !== null && value !== "") {
        detail.Response_Value__c = Array.isArray(value)
          ? value.join(";")
          : value;
      }

      responseDetails.push(detail);
    }

    // Save responses
    this.isLoading = true;
    saveAssessmentResponse({ response, responses: responseDetails })
      .then(() => {
        this.showToast(
          "Success",
          "Assessment submitted successfully.",
          "success"
        );
        // You can redirect or reset the form as needed
        this.responses = {};
        this.loadQuestions();
      })
      .catch((error) => {
        this.error = error;
        this.showToast("Error", this.getErrorMessage(error), "error");
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  get errorMessage() {
    return this.getErrorMessage(this.error);
  }

  getErrorMessage(error) {
    let errorMessage = "An unknown error occurred.";
    if (error) {
      if (error.body && error.body.message) {
        errorMessage = error.body.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
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
      mode: "dismissable"
    });
    this.dispatchEvent(evt);
  }
}