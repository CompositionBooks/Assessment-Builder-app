public with sharing class AssessmentInstanceController {

    /**
     * Retrieves assessment instances associated with a specific record.
     */
    @AuraEnabled(cacheable=true)
    public static List<Assessment_Instance__c> getAssessmentInstances(Id recordId, String objectApiName, String assessmentTemplateField) {
        System.debug('Entering getAssessmentInstances');
        System.debug('Parameters: recordId=' + recordId + ', objectApiName=' + objectApiName + ', assessmentTemplateField=' + assessmentTemplateField);

        try {
            List<Assessment_Instance__c> instances = [
                SELECT Id, Name, Template__c, Record_ID__c, Object_API_Name__c, Start_Date__c
                FROM Assessment_Instance__c
                WHERE Record_ID__c = :recordId
                ORDER BY Start_Date__c DESC
            ];

            System.debug('Retrieved instances: ' + instances);
            return instances;
        } catch (Exception ex) {
            System.debug('Exception in getAssessmentInstances: ' + ex);
            throw new AuraHandledException('Error retrieving assessment instances: ' + ex.getMessage());
        }
    }

    /**
     * Creates a new assessment instance for a given record.
     */
    @AuraEnabled
    public static Assessment_Instance__c createNewAssessmentInstance(Id recordId, String objectApiName, String assessmentTemplateField) {
        System.debug('Entering createNewAssessmentInstance');
        System.debug('Parameters: recordId=' + recordId + ', objectApiName=' + objectApiName + ', assessmentTemplateField=' + assessmentTemplateField);

        try {
            Id templateId = AssessmentController.getAssessmentTemplateId(recordId, objectApiName, assessmentTemplateField);
            System.debug('Received templateId: ' + templateId);

            if (templateId == null) {
                System.debug('No Assessment Template associated with this record.');
                throw new AuraHandledException('No Assessment Template associated with this record.');
            }

            // Adjust the field name as needed
            String fieldName = 'Name'; // Change 'Name' to an existing field on your object if necessary
            System.debug('Using fieldName: ' + fieldName);

            String query = 'SELECT ' + fieldName + ' FROM ' + objectApiName + ' WHERE Id = :recordId';
            System.debug('SOQL Query: ' + query);

            SObject record = Database.query(query);
            System.debug('Retrieved record: ' + record);

            String recordName = (String) record.get(fieldName);
            System.debug('Retrieved recordName: ' + recordName);

            if (String.isBlank(recordName)) {
                recordName = 'Unknown Record';
            }

            Assessment_Instance__c newInstance = new Assessment_Instance__c();
            newInstance.Name = 'Assessment for ' + recordName + ' on ' + System.today().format();
            newInstance.Record_ID__c = recordId;
            newInstance.Object_API_Name__c = objectApiName;
            newInstance.Template__c = templateId;
            newInstance.Status__c = 'In Progress';
            newInstance.Start_Date__c = System.now();

            System.debug('Inserting new Assessment_Instance__c: ' + newInstance);

            insert newInstance;

            System.debug('Successfully inserted Assessment_Instance__c with Id: ' + newInstance.Id);

            return newInstance;
        } catch (AuraHandledException ahe) {
            System.debug('AuraHandledException in createNewAssessmentInstance: ' + ahe.getMessage());
            throw ahe;
        } catch (DmlException dmlex) {
            System.debug('DmlException in createNewAssessmentInstance: ' + dmlex.getMessage());
            throw new AuraHandledException('DML Exception while creating assessment instance: ' + dmlex.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Exception in createNewAssessmentInstance: ' + e.getMessage());
            throw new AuraHandledException('Error creating assessment instance: ' + e.getMessage());
        }
    }
}
