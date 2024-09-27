import { LightningElement, api } from "lwc";

export default class QuestionRenderer extends LightningElement {
  @api question;

  get isTextType() {
    return ["Single Line Text", "Paragraph Text", "Date", "Number"].includes(
      this.question.Question_Type__c
    );
  }

  get inputType() {
    const typeMap = {
      "Single Line Text": "text",
      "Paragraph Text": "text",
      Date: "date",
      Number: "number"
    };
    return typeMap[this.question.Question_Type__c] || "text";
  }

  get isOptionType() {
    return [
      "Picklist (Single Select)",
      "Multi-Select Picklist",
      "Checkboxes",
      "Radio Buttons"
    ].includes(this.question.Question_Type__c);
  }

  get isPicklistType() {
    return this.question.Question_Type__c === "Picklist (Single Select)";
  }

  get isMultiSelectPicklistType() {
    return this.question.Question_Type__c === "Multi-Select Picklist";
  }

  get isCheckboxType() {
    return this.question.Question_Type__c === "Checkboxes";
  }

  get isRadioButtonType() {
    return this.question.Question_Type__c === "Radio Buttons";
  }

  get previewOptions() {
    if (this.question.options) {
      return this.question.options
        .filter((opt) => opt.Is_Active__c)
        .map((opt) => ({
          label: opt.Value__c,
          value: opt.Id || opt.key
        }));
    }
    return [];
  }

  get selectedDefaultValue() {
    const defaultOption = this.question.options
      ? this.question.options.find((opt) => opt.Is_Default__c)
      : null;
    return defaultOption ? defaultOption.Id || defaultOption.key : "";
  }
}
