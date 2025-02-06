# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import msgprint, sendmail
from frappe.email.queue import flush

class PreAlert(Document):
    pass


@frappe.whitelist()
def get_percentage_of_hsn_and_category_base(name, category):
    data = frappe.db.sql(
        " select * from `tabApplication Bond Duty Details` where parent=%s and category=%s ",
        (name, category),
        as_dict=True,
    )
    return data


@frappe.whitelist()
def get_exchange_rate(name):
    data = frappe.db.sql(
        " select exchange_rate,currency from `tabPurchase Order List` where parent=%s",
        (name),
        as_dict=True,
    )
    items_data = frappe.db.sql(
        " select * from `tabPurchase Order Details` where parent=%s ",
        (name),
        as_dict=True,
    )

    return data, items_data


@frappe.whitelist()
def get_attachments(name):
    data = frappe.db.sql(
        " select * from `tabAttach Document` where parent=%s  ", (name), as_dict=True
    )

    return data


@frappe.whitelist()
def update_rodtep(name, use_rodtep):
    data = frappe.db.sql(
        " select remaining_amount from `tabRodtep Utilization` where name=%s ",
        (name),
        as_dict=True,
    )

    remaining_rodtep = float(data[0]["remaining_amount"]) - float(use_rodtep)

    frappe.set_value("Rodtep Utilization", name, "remaining_amount", remaining_rodtep)
    if remaining_rodtep == 0:
        frappe.set_value("Rodtep Utilization", name, "status", "Use")


@frappe.whitelist()
def send_mail_to_cha(sender, cha_name, doc_name):
    # Fetch recipient emails
    recever = frappe.db.sql(
        """
            SELECT ct.email_id 
            FROM `tabContact` AS ct
            LEFT JOIN `tabDynamic Link` AS dl ON ct.name = dl.parent
            WHERE dl.link_doctype = 'Supplier' AND dl.link_name = %s
        """,
        (cha_name,),
        as_dict=True,
    )
    
    recipient = [row["email_id"] for row in recever if row["email_id"]]

    if not recipient:
        frappe.throw("No email found for the CHA.")

    # Fetch the document
    doc = frappe.get_doc("Pre Alert", doc_name)

    # Check if doc contains item_details
    if not doc.item_details:
        frappe.throw("No item details found in the document.")

    # Helper function to format numbers
    def format_currency(value):
        return f"{value:.2f}" if isinstance(value, (int, float)) else value

    # Prepare context dictionary with `exch_rate` moved outside `item_details`
    context = {
        "doc": {
            "cha": doc.cha if hasattr(doc, "cha") else cha_name,
            "exch_rate": format_currency(doc.exch_rate),  # Ensure exchange rate is part of the parent context
            "item_details": [
                {
                    "po_no": row.po_no,
                    "item_code": row.item_code,
                    "description": row.description,
                    "quantity": row.quantity,
                    "item_price": format_currency(row.item_price),
                    "amount": format_currency(row.amount),
                    "total_inr_value": format_currency(row.total_inr_value),
                    "freight_amount": format_currency(row.freight_amount),
                    "insurance_amount": format_currency(row.insurance_amount),
                    "misc_charge_amt": format_currency(row.misc_charge_amt),
                    "total_amount": format_currency(row.total_amount),
                    "bcd_": format_currency(row.bcd_),
                    "bcd_amount": format_currency(row.bcd_amount),
                    "hcs_": format_currency(row.hcs_),
                    "hcs_amount": format_currency(row.hcs_amount),
                    "swl_": format_currency(row.swl_),
                    "swl_amount": format_currency(row.swl_amount),
                    "total_duty": format_currency(row.total_duty),
                    "igst_": format_currency(row.igst_),
                    "igst_amount": format_currency(row.igst_amount),
                    "final_total_duty": format_currency(row.final_total_duty),
                }
                for row in doc.item_details
            ]
        }
    }

    # Fetch email template
    email_template = frappe.get_doc("Email Template", "CHA Notification Template")

    # Render subject and message with context
    subject = frappe.render_template(email_template.subject, context)
    message = frappe.render_template(email_template.response_html, context)

    # Debugging: Print/log the rendered message
    frappe.log_error(message, "Rendered Email Content")

    # Send email immediately
    frappe.sendmail(recipients=recipient, subject=subject, message=message, now=True)

    return "Email sent successfully."
