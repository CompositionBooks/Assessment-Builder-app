public with sharing class AssessmentInstanceController {

    @AuraEnabled(cacheable=true)
    public static List<Assessment_Instance__c> getAssessmentInstances(Id recordId, String objectApiName) {
        return [
            SELECT Id, Name, Template__c, Record_ID__c, Object_API_Name__c, Start_Date__c
            FROM Assessment_Instance__c
            WHERE Record_ID__c = :recordId
            AND Object_API_Name__c = :objectApiName
            ORDER BY Start_Date__c DESC
        ];
    }

    @AuraEnabled
    public static Assessment_Instance__c createNewAssessmentInstance(Id recordId, String objectApiName) {
        Assessment_Instance__c newInstance = new Assessment_Instance__c();
        newInstance.Record_ID__c = recordId;
        newInstance.Object_API_Name__c = objectApiName;
        newInstance.Status__c = 'In Progress';
        newInstance.Start_Date__c = System.now();
        insert newInstance;
        return newInstance;
    }
}