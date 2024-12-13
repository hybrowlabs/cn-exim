import frappe

data = [{
    "name": "Testing",
    "owner": "Administrator",
    "creation": "2024-11-27 15:42:15.146344",
    "modified": "2024-11-27 15:43:12.612134",
    "modified_by": "Administrator",
    "docstatus": 0,
    "idx": 0,
    "subject": "Refund of EMD",
    "use_html": 1,
    "response_html": '\n\tDear Sir<br><br>\n\t\t\tMay we invite your kind immediate attention to our following E.M.D./s which may please be refunded in  case the tender/s have been finalised.<br><br>\n\n\t\t\t<div>\n\t\t\t\t<table border="1" cellspacing="0" cellpadding="0" width="100%" align="center">\n\t\t\t\t\t<thead>\n\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t\t<td align="center" width="12%">Tender No</td>\n\t\t\t\t\t\t\t<td align="center" width="10%">Due Date</td>\n\t\t\t\t\t\t\t<td align="center" width="10%">EMD Amount</td>\n\t\t\t\t\t\t\t<td align="center" width="10%">Pay Mode</td>\n\t\t\t\t\t\t\t<td align="center" width="10%">Inst. No</td>\n\t\t\t\t\t\t\t<td align="center" width="15%">Bank Name</td>\n\t\t\t\t\t\t\t<td align="center" width="15%">Tender Name</td>\n\t\t\t\t\t\t</tr>\n\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t\t<td><p>{{tender_no}}</p></td>\n\t\t\t\t\t\t\t<td><p>{{frappe.format_value(due_date, dict(fieldtype=\'Date\'))}}</p></td>\n\t\t\t\t\t\t\t<td><p>{{frappe.format_value(amount, dict(fieldtype=\'Currency\'))}}</p></td>\n\t\t\t\t\t\t\t<td><p>{{payment_mode}}</p></td>\n\t\t\t\t\t\t\t<td><p>{{reference_num}}</p></td>\n\t\t\t\t\t\t\t<td><p>{{bank_account}}</p></td>\n\t\t\t\t\t\t\t<td><p>{{tender_name}}</p></td>\n\t\t\t\t\t\t</tr>\n\t\t\t\t\t</thead>\n\t\t\t\t</table>\n\t\t\t\t\n\t\t\t\t\n\n\t\t\t\tWe request for your immediate actions in this regards. <br><br>\n\t\t\t\tIf you need any clarifications for any of above invoice/s, please reach out to our Accounts Receivable Team by sending email to {{frappe.db.get_value("User",frappe.session.user,"email")}}. <br><br>\n\t\t\t\tIf refund already made from your end, kindly excuse us for this mail with the details of payments made to enable us to reconcile and credit your account. In case of online payment, sometimes, it is difficult to reconcile the name of the Payer and credit the relevant account. <br><br><br>\n\t\t\t\tThanking you in anticipation. <br><br><br>\n\t\t\t\t<strong>For, {{company}}</strong><br>\n\t\t\t\t( Accountant )\n\t\t\t</div>\n\n\t\t\t\t</div>',
    "doctype": "Email Template",
}]


# def execute():
    # frappe.new_doc("Email Template").update(data[0])
    # if frappe.db.exists("Email Template", "Testing"):
    #     pass
    # else:
	# 	frappe.get_doc(data).insert(ignore_permissions=True)
    # create_email_template_for_emd()


# def create_email_template_for_emd():
#     et = frappe.new_doc("Email Template")
#     et.name = "Testing"
#     et.subject = "Refund of EMD"
#     et.use_html == 1
#     et.response_html = """
# 	Dear Sir<br><br>
# 			May we invite your kind immediate attention to our following E.M.D./s which may please be refunded in  case the tender/s have been finalised.<br><br>

# 			<div>
# 				<table border="1" cellspacing="0" cellpadding="0" width="100%" align="center">
# 					<thead>
# 						<tr>
# 							<td align="center" width="12%">Tender No</td>
# 							<td align="center" width="10%">Due Date</td>
# 							<td align="center" width="10%">EMD Amount</td>
# 							<td align="center" width="10%">Pay Mode</td>
# 							<td align="center" width="10%">Inst. No</td>
# 							<td align="center" width="15%">Bank Name</td>
# 							<td align="center" width="15%">Tender Name</td>
# 						</tr>
# 						<tr>
# 							<td><p>{{tender_no}}</p></td>
# 							<td><p>{{frappe.format_value(due_date, dict(fieldtype='Date'))}}</p></td>
# 							<td><p>{{frappe.format_value(amount, dict(fieldtype='Currency'))}}</p></td>
# 							<td><p>{{payment_mode}}</p></td>
# 							<td><p>{{reference_num}}</p></td>
# 							<td><p>{{bank_account}}</p></td>
# 							<td><p>{{tender_name}}</p></td>
# 						</tr>
# 					</thead>
# 				</table>
				
				

# 				We request for your immediate actions in this regards. <br><br>
# 				If you need any clarifications for any of above invoice/s, please reach out to our Accounts Receivable Team by sending email to {{frappe.db.get_value("User",frappe.session.user,"email")}}. <br><br>
# 				If refund already made from your end, kindly excuse us for this mail with the details of payments made to enable us to reconcile and credit your account. In case of online payment, sometimes, it is difficult to reconcile the name of the Payer and credit the relevant account. <br><br><br>
# 				Thanking you in anticipation. <br><br><br>
# 				<strong>For, {{company}}</strong><br>
# 				( Accountant )
# 			</div>

# 				</div>"""

#     et.save(ignore_permissions=True)
