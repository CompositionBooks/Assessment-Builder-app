import { LightningElement, api, track, wire } from 'lwc';
import getAssessmentInstances from '@salesforce/apex/AssessmentInstanceController.getAssessmentInstances';
import createNewAssessmentInstance from '@salesforce/apex/AssessmentInstanceController.createNewAssessmentInstance';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, MessageContext } from 'lightning/messageService';
import ASSESSMENTMC from '@salesforce/messageChannel/AssessmentMessageChannel__c';

export default class AssessmentInstanceComponent extends LightningElement {
    @api recordId;
    @api objectApiName;
    @api assessmentTemplateField;
    @track instances = [];
    @track isLoading = false;
    @track selectedInstanceId;
    @track error;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        console.log('assessmentInstanceComponent connectedCallback');
        this.loadInstances();
    }

    // Load assessment instances for the current record
    loadInstances() {
        console.log('Loading assessment instances');
        this.isLoading = true;
        getAssessmentInstances({
            recordId: this.recordId,
            objectApiName: this.objectApiName,
            assessmentTemplateField: this.assessmentTemplateField
        })
            .then(result => {
                console.log('Received instances:', result);
                this.instances = result;
                this.updateInstanceVariants(); // Update variants after loading instances
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading instances:', error);
                this.error = error;
                this.showToast('Error', this.getErrorMessage(error), 'error');
                this.isLoading = false;
            });
    }

    // Create a new assessment instance
    handleNewInstance() {
        console.log('Creating new assessment instance');
        createNewAssessmentInstance({
            recordId: this.recordId,
            objectApiName: this.objectApiName,
            assessmentTemplateField: this.assessmentTemplateField
        })
            .then(result => {
                console.log('New instance created:', result);
                // Add the new instance to the list and select it
                this.instances = [result, ...this.instances];
                this.selectedInstanceId = result.Id;
                this.updateInstanceVariants();
                this.publishInstanceSelected(result.Id);
                this.showToast('Success', 'New Assessment Instance Created', 'success');
            })
            .catch(error => {
                console.error('Error creating new instance:', error);
                this.error = error;
                this.showToast('Error', this.getErrorMessage(error), 'error');
            });
    }

    // Handle instance selection
    handleInstanceClick(event) {
        const instanceId = event.currentTarget.dataset.instanceId;
        console.log('Instance selected:', instanceId);
        this.selectedInstanceId = instanceId;
        this.updateInstanceVariants();
        this.publishInstanceSelected(instanceId);
    }

    // Update the variant for each instance based on the selected instance
    updateInstanceVariants() {
        this.instances = this.instances.map(instance => {
            return {
                ...instance,
                variant: instance.Id === this.selectedInstanceId ? 'brand' : 'neutral'
            };
        });
    }

    // Publish message when an instance is selected
    publishInstanceSelected(instanceId) {
        console.log('Publishing selected instanceId:', instanceId);
        const payload = { instanceId: instanceId };
        publish(this.messageContext, ASSESSMENTMC, payload);
    }

    // Utility to show toast messages
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
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
        }
        return errorMessage;
    }
}
