// AssessmentController.cls
public with sharing class AssessmentController {

    /**
     * Retrieves the assessment template ID associated with a record.
     */
    @AuraEnabled(cacheable=true)
    public static Id getAssessmentTemplateId(Id recordId, String objectApiName, String fieldApiName) {
        System.debug('Entering getAssessmentTemplateId');
        System.debug('Parameters: recordId=' + recordId + ', objectApiName=' + objectApiName + ', fieldApiName=' + fieldApiName);

        try {
            // Get the object type
            Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectApiName);
            System.debug('objectType: ' + objectType);

            if (objectType == null) {
                System.debug('Invalid object API name: ' + objectApiName);
                throw new AuraHandledException('Invalid object API name: ' + objectApiName);
            }

            // Describe the object
            Schema.DescribeSObjectResult describeResult = objectType.getDescribe();
            System.debug('describeResult: ' + describeResult);

            if (!describeResult.isAccessible()) {
                System.debug('No access to object: ' + objectApiName);
                throw new AuraHandledException('No access to object: ' + objectApiName);
            }

            // Get the fields map
            Map<String, Schema.SObjectField> fieldsMap = describeResult.fields.getMap();
            System.debug('fieldsMap keys: ' + fieldsMap.keySet());

            if (!fieldsMap.containsKey(fieldApiName)) {
                System.debug('Field does not exist: ' + fieldApiName);
                throw new AuraHandledException('Field ' + fieldApiName + ' does not exist on object ' + objectApiName);
            }

            // Get the field
            Schema.SObjectField field = fieldsMap.get(fieldApiName);
            System.debug('field: ' + field);

            if (!field.getDescribe().isAccessible()) {
                System.debug('No access to field: ' + fieldApiName);
                throw new AuraHandledException('No access to field: ' + fieldApiName);
            }

            // Query the record
            String query = 'SELECT ' + fieldApiName + ' FROM ' + objectApiName + ' WHERE Id = :recordId';
            System.debug('SOQL Query: ' + query);

            SObject record = Database.query(query);
            System.debug('Record: ' + record);

            Id templateId = (Id) record.get(fieldApiName);
            System.debug('Retrieved templateId: ' + templateId);

            return templateId;
        } catch (Exception ex) {
            System.debug('Exception in getAssessmentTemplateId: ' + ex);
            throw new AuraHandledException('Error fetching template ID: ' + ex.getMessage());
        }
    }

    /**
     * Retrieves assessment questions based on the template ID.
     */
    @AuraEnabled(cacheable=true)
    public static List<Assessment_Question__c> getAssessmentQuestions(Id templateId) {
        System.debug('Entering getAssessmentQuestions with templateId: ' + templateId);

        try {
            // Enforce FLS and CRUD
            if (!Schema.sObjectType.Assessment_Question__c.isAccessible()) {
                throw new AuraHandledException('You do not have permission to access Assessment Questions.');
            }

            List<Assessment_Question__c> questions = [
                SELECT
                    Id,
                    Question_Text__c,
                    Question_Type__c,
                    Is_Required__c,
                    Sequence_Number__c,
                    (
                        SELECT Id, Value__c, Is_Active__c, Sequence_Number__c
                        FROM Question_Options__r
                        WHERE Is_Active__c = TRUE
                        ORDER BY Sequence_Number__c
                    )
                FROM Assessment_Question__c
                WHERE Template__c = :templateId
                ORDER BY Sequence_Number__c
            ];

            System.debug('Retrieved questions: ' + questions);
            return questions;
        } catch (Exception ex) {
            System.debug('Exception in getAssessmentQuestions: ' + ex);
            throw new AuraHandledException('Error retrieving assessment questions: ' + ex.getMessage());
        }
    }

    /**
     * Retrieves assessment questions and existing responses for a given assessment instance.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAssessmentQuestionsAndResponses(Id instanceId) {
        System.debug('Entering getAssessmentQuestionsAndResponses with instanceId: ' + instanceId);

        try {
            Map<String, Object> result = new Map<String, Object>();

            // Retrieve the assessment instance and its associated template
            Assessment_Instance__c instance = [
                SELECT Id, Template__c
                FROM Assessment_Instance__c
                WHERE Id = :instanceId
                LIMIT 1
            ];

            System.debug('Retrieved instance: ' + instance);

            // Fetch questions associated with the template
            List<Assessment_Question__c> questions = [
                SELECT Id, Question_Text__c, Question_Type__c, Is_Required__c, Sequence_Number__c,
                    (SELECT Id, Value__c, Is_Active__c, Sequence_Number__c FROM Question_Options__r WHERE Is_Active__c = TRUE ORDER BY Sequence_Number__c)
                FROM Assessment_Question__c
                WHERE Template__c = :instance.Template__c
                ORDER BY Sequence_Number__c
            ];

            System.debug('Retrieved questions: ' + questions);

            // Fetch existing responses for the instance
            Map<Id, String> responses = new Map<Id, String>();
            for (Assessment_Response__c response : [
                SELECT Question__c, Response_Value__c
                FROM Assessment_Response__c
                WHERE Assessment_Instance__c = :instanceId
            ]) {
                responses.put(response.Question__c, response.Response_Value__c);
            }

            System.debug('Retrieved responses: ' + responses);

            result.put('questions', questions);
            result.put('responses', responses);

            return result;
        } catch (Exception ex) {
            System.debug('Exception in getAssessmentQuestionsAndResponses: ' + ex);
            throw new AuraHandledException('Error retrieving questions and responses: ' + ex.getMessage());
        }
    }

     /**
     * Wrapper class for Assessment Responses.
     */
    public class AssessmentResponseWrapper {
        @AuraEnabled
        public Id questionId;
        @AuraEnabled
        public String responseValue;

        // Add this constructor
        public AssessmentResponseWrapper(Id questionId, String responseValue) {
            this.questionId = questionId;
            this.responseValue = responseValue;
        }
    }

    /**
     * Saves assessment responses for a given assessment instance.
     */
    @AuraEnabled
    public static void saveAssessmentResponses(Id instanceId, List<Map<String, Object>> responses) {
        System.debug('Entering saveAssessmentResponses with instanceId: ' + instanceId);
        System.debug('Responses to save: ' + JSON.serialize(responses));

        try {
            // Enforce CRUD and FLS permissions
            if (!Schema.sObjectType.Assessment_Response__c.isCreateable()) {
                System.debug('User does not have create access to Assessment_Response__c');
                throw new AuraHandledException('You do not have permission to create Assessment Responses.');
            }

            // Build Assessment_Response__c records from the map
            List<Assessment_Response__c> responseRecords = new List<Assessment_Response__c>();
            for (Map<String, Object> responseMap : responses) {
                Assessment_Response__c response = new Assessment_Response__c();
                response.Assessment_Instance__c = instanceId;
                response.Question__c = (Id)responseMap.get('Question__c');
                response.Response_Value__c = (String)responseMap.get('Response_Value__c');
                response.Record_ID__c = (String)responseMap.get('Record_ID__c');
                response.Object_API_Name__c = (String)responseMap.get('Object_API_Name__c');

                System.debug('Prepared response record: ' + response);
                responseRecords.add(response);
            }

            // Insert responses
            insert responseRecords;
            System.debug('Inserted new responses.');

            // Update the instance status and end date
            Assessment_Instance__c instanceToUpdate = new Assessment_Instance__c(
                Id = instanceId,
                Status__c = 'Completed',
                End_Date__c = System.now()
            );

            update instanceToUpdate;
            System.debug('Updated assessment instance status to Completed.');

        } catch (DmlException dmlex) {
            System.debug('DmlException in saveAssessmentResponses: ' + dmlex.getMessage());
            throw new AuraHandledException('Error saving assessment responses: ' + dmlex.getDmlMessage(0));
        } catch (Exception ex) {
            System.debug('Exception in saveAssessmentResponses: ' + ex.getMessage());
            throw new AuraHandledException('Error saving assessment responses: ' + ex.getMessage());
        }
    }

}
