﻿
function GetNextVisit(outlet){
	var q = new Query("SELECT Id, PlanDate FROM Document_MobileAppPlanVisit WHERE Outlet=@outlet AND DATE(PlanDate)>=DATE(@date) AND Transformed=0 LIMIT 1");
	q.AddParameter("outlet", outlet);
	q.AddParameter("date", DateTime.Now.Date);
	var res = q.Execute();
	res.Next();	
	return res;
	
}

function OrderCheckRequired(visit, wfName) {
    if (visit.Plan.EmptyRef()==false && GetOrderControlValue() && OrderExists(visit) == false)
        return true;
    else
        return false;
}

function OrderExists(visit) {
    //var p = DB.Current.Document.Order.SelectBy("Visit", visit.Id).First();
    var q = new Query("SELECT Id FROM Document_Order WHERE Visit=@visit");
    q.AddParameter("visit", visit);
    var p = q.ExecuteScalar();
    if (p == null)
        return false;
    else
        return true;
}

function SetDeliveryDate(order, control) {
    DateTimeDialog(order, "DeliveryDate", order.DeliveryDate, control);
}

function SetnextVisitDate(nextVisit, control){
	if (String.IsNullOrEmpty(nextVisit.Id))
		var nextDate = DateTime.Now;
	else
		var nextDate = nextVisit.PlanDate;
	Dialog.ShowDateTime(Translate["#enterDateTime#"], nextDate, NextDateHandler, [nextVisit, control]);
}

function GetOrderControlValue() {
    //var orderFillCheck = DB.Current.Catalog.MobileApplicationSettings.SelectBy("Code", "NOR").First();
    var q = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='NOR'");
    var uvr = q.ExecuteScalar();

    if (uvr == null)
        return false;
    else {
        if (parseInt(uvr) == parseInt(0))
            return false
        else
            return true;
    }
}

function VisitReasonCheckrequired(wfName, visit) {
    if (visit.Plan.EmptyRef() && GetUVRvalue())
        return true
    else
        return false;
}

function GetUVRvalue() {
    //var uvr = DB.Current.Catalog.MobileApplicationSettings.SelectBy("Code", "UVR").First();
    var q = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='UVR'");
    var uvr = q.ExecuteScalar();
    if (uvr == null)
        return false;
    else {
        if (parseInt(uvr) == parseInt(0))
            return false
        else
            return true;
    }
}

function CountAnswers(visitId, skuAnsw) {
    var query = new Query("SELECT Id FROM Document_Visit_Questions WHERE Ref=@ref");
    query.AddParameter("ref", visitId);
    var q = query.ExecuteCount();
    return (q + skuAnsw);
}

function CountDoneTasks(visit) {
    var query = new Query("SELECT Id FROM Document_Visit_Task WHERE Ref=@ref");
    query.AddParameter("ref", visit);
    return query.ExecuteCount();
}

function CountTasks(outlet) {
    //return DB.Current.Document.Task.SelectBy("Outlet", outlet.Id).Where("PlanDate >= @p1", [DateTime.Now.Date]).Count();
    var query = new Query("SELECT Id FROM Document_Task WHERE PlanDate >= @planDate AND Outlet = @outlet");
    query.AddParameter("outlet", outlet);
    query.AddParameter("planDate", DateTime.Now.Date);
    return query.ExecuteCount();
}

function GetOrderSUM(order) {
    var query = new Query("SELECT SUM(Qty*Total) FROM Document_Order_SKUs WHERE Ref = @Ref");
    query.AddParameter("Ref", order);
    var sum = query.ExecuteScalar();
    if (sum == null)
        return 0;
    else
        return String.Format("{0:F2}", sum);
}

function CheckAndCommit(order, visit, wfName) {

	if (VisitIsChecked(visit, order, wfName)) {
        visit = visit.GetObject();
    	visit.EndTime = DateTime.Now;

        if (OrderExists(visit.Id)) {
            order.GetObject().Save();
        }

        FillQuestionnaires();
        
        visit.Save();
        Workflow.Commit();
    }
    else
        Dialog.Message(Translate["#messageNulls#"]);

}


//--------------------------internal functions--------------


function NextDateHandler(date, args){

	var newVistPlan = args[0];

	if (newVistPlan.Id==null){
		newVistPlan = DB.Create("Document.MobileAppPlanVisit");
		newVistPlan.SR = $.common.UserRef;	
		newVistPlan.Outlet = $.workflow.outlet;
		newVistPlan.Transformed = false;
		newVistPlan.Date = DateTime.Now;
	}
	else
		newVistPlan = newVistPlan.Id.GetObject();
	newVistPlan.PlanDate = date;
	newVistPlan.Save();
	
	//control.Text = date;
	Workflow.Refresh([]);
}


function VisitIsChecked(visit, order, wfName) {
    if (OrderCheckRequired(visit, wfName) && visit.ReasonForNotOfTakingOrder.EmptyRef())
        return false;
    else {
        if (VisitReasonCheckrequired(wfName, visit) && visit.ReasonForVisit.EmptyRef())
            return false;
        else
            return true;
    }
}

function FillQuestionnaires() {
	
	var str = CreateCondition($.workflow.questionnaires, " D.Id ");
	var q = new Query("SELECT D.Single, VQ.Id AS AnswerId, NULL AS SKU, Q.ChildQuestion AS Question, Q.Ref AS Questionnaire, VQ.AnswerDate, VQ.Answer, VQ.Ref AS Visit " +
			" FROM Document_Visit_Questions VQ " +
			" JOIN Document_Questionnaire_Questions Q ON VQ.Question=Q.ChildQuestion " +
			" JOIN Document_Questionnaire D ON Q.Ref=D.Id " +
			" WHERE VQ.Ref=@visit AND " + str + 
			" UNION ALL " +
			" SELECT D.Single, VQ.Id AS AnswerId, S.SKU, Q.ChildQuestion AS Question, Q.Ref AS Questionnaire, VQ.AnswerDate, VQ.Answer, VQ.Ref AS Visit  " +
			" FROM Document_Visit_SKUs VQ " +
			" JOIN Document_Questionnaire_SKUQuestions Q ON VQ.Question=Q.ChildQuestion " +
			" JOIN Document_Questionnaire_SKUs S ON Q.Ref=S.Ref AND S.SKU=VQ.SKU " +
			" JOIN Document_Questionnaire D ON Q.Ref=D.Id " +
			" WHERE VQ.Ref=@visit AND " + str + " ORDER BY SKU, ChildQuestion ");
	
	q.AddParameter("emptySKURef", DB.EmptyRef("Catalog_SKU"));
	q.AddParameter("outlet", $.workflow.outlet);
	q.AddParameter("visit", $.workflow.visit);
	var res = q.Execute().Unload();
	
	var lastSKU;
	var lastQuestion;
	
	Dialog.Debug(res.Count());
	
	while (res.Next()) {
		if (NewQuestion(lastSKU, res.SKU, lastQuestion, res.Question)==false) 
			var answerObj = res.AnswerId.GetObject();
		else{
			
			var sku = res.SKU;
			if (sku==null)
				sku = DB.EmptyRef("Catalog_SKU");
			
			if (sku.ToString()==(DB.EmptyRef("Catalog_SKU")).ToString())
				var answerObj = DB.Create("Document.Visit_Questions");
			else{
				var answerObj = DB.Create("Document.Visit_SKUs");
				answerObj.SKU = sku; 
			}
			
			answerObj.Ref = res.Visit;
			answerObj.Question = res.Question;
			answerObj.Answer = res.Answer;
			answerObj.AnswerDate = res.Answerdate;
		}
		answerObj.Questionnaire = res.Questionnaire;
		Dialog.Debug(answerObj);
		answerObj.Save();
		if (res.Single==1){
			var q2 = new Query("SELECT Id FROM Catalog_Outlet_AnsweredQuestions WHERE Questionnaire=@questionnaire " +
					"AND Ref=@outlet AND Question=@question AND SKU=@sku");
			q2.AddParameter("questionnaire", res.Questionnaire);
			q2.AddParameter("outlet", $.workflow.outlet);
			q2.AddParameter("sku", res.SKU);
			
			if (res.OutletAnswerId==null || NewQuestion(lastSKU, res.SKU, lastQuestion, res.Question)){
				var outletAnswer = DB.Create("Catalog.Outlet_AnsweredQuestions");
				outletAnswer.Ref = $.workflow.outlet;
				outletAnswer.Questionaire = res.Questionnaire;
				outletAnswer.Question = res.Question;
				if (res.SKU!=null)
					outletAnswer.SKU = res.SKU;
			}
			else
				var outletAnswer = res.OutletAnswerId.GetObject();
			outletAnswer.Answer = res.Answer;
			outletAnswer.AnswerDate = res.AnswerDate;
			outletAnswer.Save();			
		}
		lastSKU = res.SKU;
		lastQuestion = res.Question;
	}
	
}

//(lastSKU==null && lastQuestion!=res.Question) || (lastSKU!=res.SKU || lastQuestion!=res.Question))
function NewQuestion(lastSKU, currSKU, lastQuestion, currQuestion) {
	if (lastSKU==null)
		lastSKU = DB.EmptyRef("Catalog_SKU");
	if (lastSKU==DB.EmptyRef("Catalog_SKU") && lastQuestion!=currQuestion)
		return true;
	if (lastSKU!=currSKU || lastQuestion!=currQuestion)
		return true;
	return false;
}

function CreateCondition(list, field) {
	var str = "";
	var notEmpty = false;
	
	for ( var quest in list) {	
		if (String.IsNullOrEmpty(str)==false){
			str = str + ", ";		
		}
		str = str + " '" + quest.ToString() + "' ";		
		notEmpty = true;
	}
	if (notEmpty){
		str = field + " IN ( " + str  + ") ";
	}
	
	return str;
}


function DialogCallBack(control, key){
	control.Text = key;
}