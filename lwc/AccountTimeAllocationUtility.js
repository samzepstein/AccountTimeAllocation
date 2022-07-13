import { LightningElement, wire, track } from "lwc";
import getAccounts from "@salesforce/apex/AccountTimeAllocationUtilityController.getAccounts";
import getAccountFromSearch from "@salesforce/apex/AccountTimeAllocationUtilityController.getAccountFromSearch";
import createTimeTrackers from "@salesforce/apex/AccountTimeAllocationUtilityController.createTimeTrackers";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";


const COLS = [
{
  label: "Account Name",
  fieldName: "Name",
  initialWidth: 175,
  sortable: true,
  editable: false
},
{
  label: "Account Name Link",
  fieldName: "link",
  type: "url",
  initialWidth: 175,
  sortable: true,
  editable: false,
  typeAttributes: {
    label: { fieldName: "Name" },
    target: "_blank"
  }
},
{
  label: "FLEXE Priority",
  fieldName: "FLEXE_Priority__c",
  initialWidth: 150,
  editable: false,
  },
{
  label: "⏰ Hours",
  fieldName: "Hours__c",
  type: "number",
  initialWidth: 150,
  editable: true,
}

]

const COLS_PV = [
  {
    label: "Account Name",
    fieldName: "Name",
    initialWidth: 175,
    sortable: true,
    editable: false
  },
  {
    label: "Account Name Link",
    fieldName: "link",
    type: "url",
    initialWidth: 175,
    sortable: true,
    editable: false,
    typeAttributes: {
      label: { fieldName: "Name" },
      target: "_blank"
    }
  },
  {
    label: "FLEXE Priority",
    fieldName: "FLEXE_Priority__c",
    initialWidth: 150,
    editable: false,
    },
  {
    label: "⏰ Hours",
    fieldName: "Hours__c",
    type: "number",
    initialWidth: 150,
    editable: true,
  }
]



export default class AccountTimeAllocationUtility extends LightningElement {

  getAccountsList;
  getAccountFromSearchList;
  workingList;
  selectedRows;
  draftValues = [];
  pendingValues = [];
  columns = COLS;
  pvColumns = COLS_PV;
  showSpinner = false;
  showWarning = false;
  radioSelection = "user";
  disableAccountLookup = true;
  selectedAccount;
  isModalOpen = false;
  sortDirection = "asc";
  sortBy = "Name";

  get disableCreate() {
      return this.pendingValues.length === 0 ? true : false;
    }

    get disableStage() {
      let result = true;
      this.draftValues.forEach((dv) => {
        if (this.isComplete(dv)) {
          result = false;
        }
      });
      return result;
    }


get radioOptions() {
  return [
      { label: "My Accounts", value: "user" },
      { label: "Account from Search", value: "account" }
  ];
  }

@wire(getAccounts)
accounts(result) {
  if (result.data) {
  this.getAccountsList = result;
  if (this.radioSelection === "user") {
      this.workingList = this.prepData([...this.getAccountsList.data]);
  }
  this.error = undefined;
  } else if (result.error) {
  this.error = result.error;
  }
}

@wire(getAccountFromSearch, {
  Id: "$selectedAccount"
})
accountsFromSearch(result) {
  if (result.data) {
  this.getAccountFromSearchList = result;
  if (this.radioSelection === "account") {
      this.workingList = this.prepData([
      ...this.getAccountFromSearchList.data
      ]);
  }
  this.errorFromAccount = undefined;
  } else if (result.error) {
  this.errorFromAccount = result.error;
  }
}
//MAYBE DELETE
picklistChanged(event) {
  event.stopPropagation();
  let dataReceived = event.detail.data;
  let copyDraftValues = [...this.draftValues];
  let draftRecords = copyDraftValues.filter(
    (item) => item.Id == dataReceived.context
  );
  if (draftRecords.length != 0) {
    draftRecords[0][dataReceived.field] = dataReceived.value;
  } else {
    let newRecord = Object.assign(
      {},
      this.workingList.filter((item) => item.Id == dataReceived.context)[0]
    );
    newRecord[dataReceived.field] = dataReceived.value;
    copyDraftValues.push(newRecord);
  }
  copyDraftValues.forEach((record) => {
    let wLRecords = this.workingList.filter(
      (wLRecord) => wLRecord.Id === record.Id
    );
    if (this.isComplete(record)) {
      wLRecords[0].rowStatus = "slds-text-color_success";
    } else {
      wLRecords[0].rowStatus = "slds-text-color_error";
    }
  });
  this.draftValues = copyDraftValues;
}

handleRadioChange(event) {
  this.radioSelection = event.detail.value;
  if (this.pendingValues.length !== 0 || this.draftValues.length !== 0) {
      this.isModalOpen = true;
  } else {
      this.processRadioChange();
  }
  }


  processRadioChange() {
  this.isModalOpen = false;
  this.pendingValues = [];
  this.draftValues = [];
  if (this.radioSelection === "account") {
      this.disableAccountLookup = false;
      this.workingList = [];
  } else {
      this.disableAccountLookup = true;
      this.template.querySelector("c-custom-lookup-lwc").handleRemove();
      this.workingList = this.prepData([...this.getAccountsList.data]);
  }
  }

  handleCellChange(event) {
      let dataReceived = event.detail.draftValues[0];
      let copyDraftValues = [...this.draftValues];
      let draftRecords = copyDraftValues.filter(
        (item) => item.Id == dataReceived.tableKey.slice(0, 18)
      );
      if (draftRecords.length != 0) {
        draftRecords[0][Object.keys(dataReceived)[0]] =
          dataReceived[Object.keys(dataReceived)[0]];
      } else {
        let newRecord = Object.assign(
          {},
          this.workingList.filter(
            (item) => item.Id == dataReceived.tableKey.slice(0, 18)
          )[0]
        );
        newRecord[Object.keys(dataReceived)[0]] =
          dataReceived[Object.keys(dataReceived)[0]];
        copyDraftValues.push(newRecord);
      }
      this.draftValues = copyDraftValues;
    }
    
    handleSave() {
      this.showWarning = true;
      window.clearTimeout(this.timeOut);
      this.timeOut = setTimeout(() => {
        this.showWarning = false;
      }, 4000);
      let completeRecords = this.draftValues.filter((record) =>
        this.isComplete(record)
      );
      this.pendingValues = [];
      this.workingList.forEach((wLRecord) => {
        let draftRecord = completeRecords.find(function (completeRecord) {
          return completeRecord.Id == wLRecord.Id;
        });
        if (draftRecord) {
          this.pendingValues.push(draftRecord);
        }
      });
      this.pendingValues = [...this.pendingValues];
    }

    handlePendingClear() {
      this.pendingValues = [];
    }

    closeModal() {
      this.isModalOpen = false;
      if (this.radioSelection === "user") {
        this.radioSelection = "account";
      } else {
        this.radioSelection = "user";
      }
    }
    
    handleCancel(event) {
      this.draftValues = [];
      let newList = this.prepData([...this.workingList]);
      newList.forEach((item) => {
        item.tableKey = item.tableKey + "x";
      });
      this.workingList = newList;
    }
    
    //add new fields here to be updated
    async handleSubmit() {
      this.showSpinner = true;
      let recordInputs = [];
      const today = new Date();
      this.pendingValues.forEach((record) => {
        let recordInput = {
          Account__c: record.Id,
          Hours__c: record.Hours__c
        };
        recordInputs.push(recordInput);
      });
      let result = "";
      try {
        result = await createTimeTrackers({ data: recordInputs });
        this.showSpinner = false;
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Success",
            message: "Time Tracker Records Created",
            variant: "success"
          })
        );
        return refreshApex(this.getAccountsList).then(() => {
          this.pendingValues = [];
          this.draftValues = [];
          let newList = this.prepData([...this.workingList]);
          newList.forEach((item) => {
            item.tableKey = item.tableKey + "x";
          });
          this.workingList = newList;
        });
      } catch (error) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Error creating records",
            message: error.body.message,
            variant: "error"
          })
        );
      }
      return result;
    }


accountLookup(event) {
  if (event.detail.selectedRecord === undefined) {
    this.selectedAccount = undefined;
    this.workingList = [];
    this.draftValues = [];
  } else {
    this.selectedAccount = event.detail.selectedRecord.Id;
    console.log(this.selectedAccount);
  }
}

handleStageRowAction(event) {
  const action = event.detail.action;
  const row = event.detail.row;
  if (action.name == "remove") {
    this.pendingValues = this.pendingValues.filter(
      (record) => record.Id !== row.Id
    );
  }
}

flattenObject(ob) {
  var toReturn = {};

  for (let i in ob) {
    if (!Object.prototype.hasOwnProperty.call(ob, i)) continue;

    if (typeof ob[i] == "object" && ob[i] !== null) {
      let flatObject = this.flattenObject(ob[i]);
      for (let x in flatObject) {
        if (!Object.prototype.hasOwnProperty.call(flatObject, x)) continue;

        toReturn[i + "_" + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

prepData(array) {
  let newResults = [];
  array.forEach((element) => {
    newResults.push(this.flattenObject(element));
  });
  newResults.forEach((item) => {
    item.link = "/one/one.app?#/sObject/" + item.Id + "/view";
    item.Hours__c = "";
    if (!item.tableKey) {
      item.tableKey = item.Id;
    }
  });
  return newResults.sort((a, b) =>
    a.Name > b.Name ||
    a.Id > b.Id
      ? 1
      : -1
  );
}
//put new fields here to make sure user can't Stage Pending Records w/o filling them out
isComplete(record) {
  if (
    record.Hours__c !== undefined &&
    record.Hours__c!== ""
  ) {
    return true;
  }
  return false;
}

updateColumnSorting(event) {
  let fieldName = event.detail.fieldName;
  let sortDirection = event.detail.sortDirection;
  this.sortBy = fieldName;
  this.sortDirection = sortDirection;
  this.sortData(fieldName, sortDirection);
}

sortData(fieldName, sortDirection) {
  let sortResult = Object.assign([], this.workingList);
  this.workingList = sortResult.sort(function (a, b) {
    if (a[fieldName] < b[fieldName]) {
      return sortDirection === "asc" ? -1 : 1;
    } else if (a[fieldName] > b[fieldName]) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });
}


}
