import { LightningElement, api } from "lwc";

export default class ErrorPanel extends LightningElement {
  @api message;

  get formattedMessage() {
    if (this.message && this.message.body && this.message.body.message) {
      return this.message.body.message;
    }
    return this.message;
  }
}