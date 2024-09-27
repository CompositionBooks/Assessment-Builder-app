import { LightningElement, api, track } from "lwc";
import getAssessmentInstances from "@salesforce/apex/AssessmentInstanceController.getAssessmentInstances";
import createNewAssessmentInstance from "@salesforce/apex/AssessmentInstanceController.createNewAssessmentInstance";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class AssessmentInstanceComponent extends LightningElement {
    @api recordId; // Record ID (e.g., Account)
    @api objectApiName; // Object API Name (e.g., Account, Contact, etc.)
    @track instances = []; // List of assessment instances
    @track isLoading = false; // Loader

    connectedCallback() {
        this.loadInstances();
    }

    // Load assessment instances for the current record
    loadInstances() {
        this.isLoading = true;
        getAssessmentInstances({ recordId: this.recordId, objectApiName: this.objectApiName })
            .then(result => {
                this.instances = result;
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', 'Error loading instances', 'error');
                this.isLoading = false;
            });
    }

    // Create a new assessment instance
    handleNewAssessment() {
        createNewAssessmentInstance({ recordId: this.recordId, objectApiName: this.objectApiName })
            .then(result => {
                // Add the new instance to the list and notify the parent component
                this.instances.push(result);
                this.dispatchInstanceSelectedEvent(result.Id);
                this.showToast('Success', 'New Assessment Instance Created', 'success');
            })
            .catch(error => {
                this.showToast('Error', 'Error creating assessment instance', 'error');
            });
    }

    // Handle instance selection
    handleInstanceClick(event) {
        const instanceId = event.currentTarget.dataset.id;
        this.dispatchInstanceSelectedEvent(instanceId);
    }

    // Dispatch custom event when an instance is selected
    dispatchInstanceSelectedEvent(instanceId) {
        const instanceSelectedEvent = new CustomEvent('instanceselected', {
            detail: { instanceId }
        });
        this.dispatchEvent(instanceSelectedEvent);
    }

    // Utility to show toast messages
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }
}