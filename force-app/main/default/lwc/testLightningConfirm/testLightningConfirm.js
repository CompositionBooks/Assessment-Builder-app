import { LightningElement } from "lwc";
import LightningConfirm from "lightning/confirm";

export default class MyApp extends LightningElement {
  async handleConfirmClick() {
    const result = await LightningConfirm.open({
      message: "Confirm with YES or Cancel with NO",
      variant: "header",
      label: "Are you sure?",
      theme: "warning"
      // setting theme would have no effect
    });
    //Confirm has been closed
    //result is true if OK was clicked
    //and false if cancel was clicked
  }
}
