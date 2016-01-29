
var summaryScreenIndex;
var leadScreenIndex;

function OnLoad() {
	summaryScreenIndex = 1;
	leadScreenIndex = 0;
	$.swipe_vl.Index = GetFirstScreenIndex();
}

function GetUnscheduledVisits() {
	return Indicators.GetUnscheduledVisits();
}

function GetEncashmentSumm() {
	return Indicators.GetEncashmentSumm();
}

function GetReceivablesSumm() {
	return Indicators.GetReceivablesSumm();
}

function GetTotal(){
	var s = Indicators.GetUnscheduledVisits() + Indicators.GetCommitedScheduledVisits();
	return s + "";
}

function GetVisitsLeft(){
	var c = GetPlannedVisits() - Indicators.GetCommitedScheduledVisits();
	return c + "";
}

function Register() {
	if (IsFilledCorrectly()) {
		SendContactsRequest(true);
		GoToSummary();
		SetContactsSentFlag();
		Dialog.Message(Translate["#leadThanks#"]);
	} else {
		Dialog.Message(Translate["#leadFillDataPlease#"]);
	}
}

function EnterUnregistered() {
	SendContactsRequest(false);
	GoToSummary();
}

function IsFilledCorrectly() {
	var IsNameFilled = $.FullName.Text != "";
	var IsPhoneFilled = $.Phone.Text != "";
	return IsNameFilled && IsPhoneFilled;
}

function GoToSummary() {
	$.swipe_vl.Index = summaryScreenIndex;
}

function GetFirstScreenIndex() {
	return (IsDemoUser() && !GetContactsSentFlag() ? leadScreenIndex : summaryScreenIndex);
}

function IsDemoUser() {
	var userRef = $.common.UserRef;
	var username = userRef.UserName;
	var password = userRef.Password;
	return username == 'demo' && password == 'demo';
}

function SetContactsSentFlag() {
	var q = new Query("CREATE TABLE USR_ContactsSent(" +
	"ID INT PRIMARY KEY NOT NULL)");
	q.Execute();
}

function GetContactsSentFlag() {
	var q = new Query("SELECT name FROM sqlite_master " +
	  "WHERE type='table' AND name='USR_ContactsSent'");
	var ContactsSent = q.ExecuteCount() == 1;
	return ContactsSent;
}

function SendContactsRequest(registered) {
	var headers = [];
	headers.push(["registered", registered]);
	headers.push(["regdate", DateTime.Now]);
	headers.push(["name", $.FullName.Text]);
	headers.push(["phone", $.Phone.Text]);
	headers.push(["os", $.common.OS]);
	SendRequest("http://192.168.21.41", "/BITSA.DEV/hs/DemoAccess", "Admin", "1", "00:00:10", headers);
}

function SendRequest(host, address, username, password, timeout, headers) {
	var request = Web.Request();
	request.Host = host;
	request.UserName = username;
	request.Password = password;
	request.Timeout = timeout;

	headers = (headers == undefined ? [] : headers);

	for (var i = 0; i < headers.length; i++) {
		request.AddHeader(headers[i][0], headers[i][1]);
	}

	request.Post(address, "");
}
