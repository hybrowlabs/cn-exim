# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt
import os
import datetime
import pytz
import frappe
# from india_compliance.gst_india.api_classes.e_waybill import EWaybillAPI
from frappe.model.document import Document


class EwayBill(Document):
    pass

@frappe.whitelist()
def get_items_details(name, pre_alert_name):

    item_data = frappe.db.sql(
        " select * from `tabBOE Entries` where parent=%s ", (name), as_dict=True
    )
    data = frappe.db.sql(
        " select * from `tabBOE Entry` where name=%s ", (name), as_dict=True
    )
    pre_alert_check_list_data = frappe.db.sql(
        "select * from `tabPre-Alert Item Details` where parent=%s ",
        (pre_alert_name),
        as_dict=True,
    )
    return item_data, data, pre_alert_check_list_data


@frappe.whitelist()
def get_all_details(name):

    data = frappe.db.sql(
        " select * from `tabPre-Alert Check List` where name=%s ", (name), as_dict=True
    )

    return data



@frappe.whitelist()
def get_gst_setting_details(doctype, field):
    return frappe.db.get_single_value(doctype, field)
