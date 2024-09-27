public with sharing class QuestionBuilderController {
    
  @AuraEnabled(cacheable=true)
  public static List<Assessment_Question__c> getQuestions(Id templateId) {
      try {
          // Enforce FLS and CRUD
          if (!Schema.sObjectType.Assessment_Question__c.isAccessible()) {
              throw new AuraHandledException('You do not have permission to access Assessment Questions.');
          }

          // Enforce FLS for Question Option fields
          if (!Schema.sObjectType.Question_Option__c.fields.Is_Active__c.isAccessible() ||
              !Schema.sObjectType.Question_Option__c.fields.Is_Default__c.isAccessible()) {
              throw new AuraHandledException('You do not have permission to access certain fields on Question Options.');
          }

          List<Assessment_Question__c> questions = [
              SELECT Id, Name, Question_Text__c, Question_Type__c, Sequence_Number__c, Is_Required__c,
                  (SELECT Id, Name, Value__c, Sequence_Number__c, Is_Active__c, Is_Default__c FROM Question_Options__r ORDER BY Sequence_Number__c)
              FROM Assessment_Question__c
              WHERE Template__c = :templateId
              ORDER BY Sequence_Number__c
          ];
          return questions;
      } catch (Exception ex) {
          throw new AuraHandledException('Error retrieving questions: ' + ex.getMessage());
      }
  }


  @AuraEnabled
  public static void updateQuestionSequences(List<Assessment_Question__c> questions) {
      try {
          // Enforce CRUD and FLS
          if (!Schema.sObjectType.Assessment_Question__c.isUpdateable()) {
              throw new AuraHandledException('You do not have permission to update Assessment Questions.');
          }

          update questions;
      } catch (Exception ex) {
          throw new AuraHandledException('Error updating question sequences: ' + ex.getMessage());
      }
  }

  @AuraEnabled
  public static void saveQuestionWithOptions(Assessment_Question__c question, List<Question_Option__c> options) {
      try {
          // Enforce CRUD and FLS for Assessment_Question__c
          if (question.Id == null) {
              if (!Schema.sObjectType.Assessment_Question__c.isCreateable()) {
                  throw new AuraHandledException('You do not have permission to create Assessment Questions.');
              }
              insert question;
          } else {
              if (!Schema.sObjectType.Assessment_Question__c.isUpdateable()) {
                  throw new AuraHandledException('You do not have permission to update Assessment Questions.');
              }
              update question;
          }

          // If options are provided, process them
          if (options != null) {
              if (!Schema.sObjectType.Question_Option__c.isAccessible()) {
                  throw new AuraHandledException('You do not have permission to access Question Options.');
              }

              // Fetch existing options from the database
              List<Question_Option__c> existingOptions = [SELECT Id FROM Question_Option__c WHERE Question__c = :question.Id];

              // Create a map of existing option Ids
              Map<Id, Question_Option__c> existingOptionsMap = new Map<Id, Question_Option__c>();
              for (Question_Option__c opt : existingOptions) {
                  existingOptionsMap.put(opt.Id, opt);
              }

              // Prepare lists for DML operations
              List<Question_Option__c> optionsToInsert = new List<Question_Option__c>();
              List<Question_Option__c> optionsToUpdate = new List<Question_Option__c>();
              List<Question_Option__c> optionsToDelete = new List<Question_Option__c>();

              // Track if an option has Is_Default__c set to true
              Boolean defaultOptionFound = false;

              // Process options from the client
              for (Question_Option__c option : options) {
                  if (option.Id == null) {
                      if (!Schema.sObjectType.Question_Option__c.isCreateable()) {
                          throw new AuraHandledException('You do not have permission to create Question Options.');
                      }
                      option.Question__c = question.Id;
                      optionsToInsert.add(option);
                  } else {
                      if (!Schema.sObjectType.Question_Option__c.isUpdateable()) {
                          throw new AuraHandledException('You do not have permission to update Question Options.');
                      }
                      optionsToUpdate.add(option);
                      // Remove the option from existingOptionsMap since it still exists
                      existingOptionsMap.remove(option.Id);
                  }

                  // Validate Is_Default__c
                  if (option.Is_Default__c) {
                      if (defaultOptionFound) {
                          throw new AuraHandledException('Only one option can be set as default.');
                      } else {
                          defaultOptionFound = true;
                      }
                  }
              }

              // Remaining options in existingOptionsMap are the ones to delete
              optionsToDelete.addAll(existingOptionsMap.values());

              // Perform DML operations
              if (!optionsToInsert.isEmpty()) {
                  insert optionsToInsert;
              }
              if (!optionsToUpdate.isEmpty()) {
                  update optionsToUpdate;
              }
              if (!optionsToDelete.isEmpty()) {
                  if (!Schema.sObjectType.Question_Option__c.isDeletable()) {
                      throw new AuraHandledException('You do not have permission to delete Question Options.');
                  }
                  delete optionsToDelete;
              }
          } else {
              // If options are null, and we're updating an existing question, we need to delete existing options
              if (question.Id != null) {
                  // Fetch existing options
                  List<Question_Option__c> existingOptions = [SELECT Id FROM Question_Option__c WHERE Question__c = :question.Id];
                  if (!existingOptions.isEmpty()) {
                      if (!Schema.sObjectType.Question_Option__c.isDeletable()) {
                          throw new AuraHandledException('You do not have permission to delete Question Options.');
                      }
                      delete existingOptions;
                  }
              }
          }
      } catch (Exception ex) {
          throw new AuraHandledException('Error saving question and options: ' + ex.getMessage());
      }
  }


  @AuraEnabled
  public static void deleteQuestion(Id questionId) {
      try {
          // Enforce CRUD and FLS
          if (!Schema.sObjectType.Assessment_Question__c.isDeletable()) {
              throw new AuraHandledException('You do not have permission to delete Assessment Questions.');
          }

          // Delete associated options first
          List<Question_Option__c> options = [
              SELECT Id FROM Question_Option__c WHERE Question__c = :questionId
          ];
          if (!options.isEmpty()) {
              if (!Schema.sObjectType.Question_Option__c.isDeletable()) {
                  throw new AuraHandledException('You do not have permission to delete Question Options.');
              }
              delete options;
          }

          // Delete the question
          delete [SELECT Id FROM Assessment_Question__c WHERE Id = :questionId];
      } catch (Exception ex) {
          throw new AuraHandledException('Error deleting question: ' + ex.getMessage());
      }
  }
}