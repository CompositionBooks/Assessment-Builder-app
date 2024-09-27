public with sharing class AssessmentController {
  @AuraEnabled(cacheable=true)
  public static List<Assessment_Question__c> getAssessmentQuestions(
    Id templateId
  ) {
    try {
      // Enforce FLS and CRUD
      if (!Schema.sObjectType.Assessment_Question__c.isAccessible()) {
        throw new AuraHandledException(
          'You do not have permission to access Assessment Questions.'
        );
      }

      List<Assessment_Question__c> questions = [
        SELECT
          Id,
          Question_Text__c,
          Question_Type__c,
          Is_Required__c,
          (
            SELECT Id, Value__c, Is_Active__c
            FROM Question_Options__r
            WHERE Is_Active__c = TRUE
            ORDER BY Sequence_Number__c
          )
        FROM Assessment_Question__c
        WHERE Template__c = :templateId
        ORDER BY Sequence_Number__c
      ];
      return questions;
    } catch (Exception ex) {
      throw new AuraHandledException(
        'Error retrieving assessment questions: ' + ex.getMessage()
      );
    }
  }

  @AuraEnabled
  public static Id saveAssessmentResponse(
    Id templateId,
    List<Assessment_Response__c> responses
  ) {
    try {
      // Enforce CRUD and FLS
      if (!Schema.sObjectType.Assessment_Instance__c.isCreateable()) {
        throw new AuraHandledException(
          'You do not have permission to create Assessment Instances.'
        );
      }
      if (!Schema.sObjectType.Assessment_Response__c.isCreateable()) {
        throw new AuraHandledException(
          'You do not have permission to create Assessment Responses.'
        );
      }

      // Create Assessment Instance
      Assessment_Instance__c instance = new Assessment_Instance__c(
        Template__c = templateId,
        Start_Date__c = System.now(),
        Status__c = 'In Progress' // Adjust based on your picklist values
      );
      insert instance;

      // Associate responses with the newly created instance
      for (Assessment_Response__c response : responses) {
        response.Assessment_Instance__c = instance.Id;
      }
      insert responses;

      // Optionally, update instance status to 'Completed' and set End Date
      instance.Status__c = 'Completed';
      instance.End_Date__c = System.now();
      update instance;

      return instance.Id;
    } catch (Exception ex) {
      throw new AuraHandledException(
        'Error saving assessment responses: ' + ex.getMessage()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Id getAssessmentTemplateId(
    Id recordId,
    String objectApiName,
    String fieldApiName
  ) {
    try {
      Schema.SObjectType objectType = Schema.getGlobalDescribe()
        .get(objectApiName);
      if (objectType == null) {
        throw new AuraHandledException(
          'Invalid object API name: ' + objectApiName
        );
      }
      Schema.DescribeSObjectResult describeResult = objectType.getDescribe();
      if (!describeResult.isAccessible()) {
        throw new AuraHandledException('No access to object: ' + objectApiName);
      }

      Map<String, Schema.SObjectField> fieldsMap = describeResult.fields.getMap();
      if (!fieldsMap.containsKey(fieldApiName)) {
        throw new AuraHandledException(
          'Field ' + fieldApiName + ' does not exist on object ' + objectApiName
        );
      }

      Schema.SObjectField field = fieldsMap.get(fieldApiName);
      if (!field.getDescribe().isAccessible()) {
        throw new AuraHandledException('No access to field: ' + fieldApiName);
      }

      String query =
        'SELECT ' +
        fieldApiName +
        ' FROM ' +
        objectApiName +
        ' WHERE Id = :recordId';
      SObject record = Database.query(query);
      return (Id) record.get(fieldApiName);
    } catch (Exception ex) {
      throw new AuraHandledException(
        'Error fetching template ID: ' + ex.getMessage()
      );
    }
  }
}
