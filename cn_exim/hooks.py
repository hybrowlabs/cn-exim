
app_name = "cn_exim"
app_title = "Cn Exim"
app_publisher = "Prathamesh Jadhav"
app_description = "Exit Customizations"
app_email = "prathamesh.j@hybrowlabs.com"
app_license = "mit"
# required_apps = []

# Includes in <head>
# ------------------


# Import the override file to apply monkey patch
# after_migrate = ["cn_exim.overrides.e_waybill_override"]

# include js, css files in header of desk.html
# app_include_css = "/assets/cn_exim/css/cn_exim.css"
# app_include_js = "/assets/cn_exim/js/purchase_order.js"

# include js, css files in header of web template
# web_include_css = "/assets/cn_exim/css/cn_exim.css"
# web_include_js = "/assets/cn_exim/js/cn_exim.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "cn_exim/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Request for Quotation": "public/js/rfq.js",
    "Purchase Receipt": "public/js/purchase_receipt.js",
    "Item": "public/js/item.js",
    "Purchase Order": "public/js/purchase_order.js",
    "Purchase Invoice": "public/js/purchase_invoice.js",
    "Landed Cost Voucher": "public/js/landed_cost_voucher.js",
    "Bill of Entry": "public/js/bill_of_entry.js",
    "Material Request": "public/js/material_request.js",
    "Blanket Order": "public/js/blanket_order.js",
    "Item Group": "public/js/item_group.js",
    "Supplier": "public/js/supplier.js",
    "Quality Inspection": "public/js/quality_inspection.js",
    "Supplier Quotation": "public/js/supplier_quotation.js",
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "cn_exim/public/icons.svg"

# Home Pages
# ----------
fixtures = [{"dt": "Funnel"}]


# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "cn_exim.utils.jinja_methods",
# 	"filters": "cn_exim.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "cn_exim.install.before_install"
# after_install = "cn_exim.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "cn_exim.uninstall.before_uninstall"
# after_uninstall = "cn_exim.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "cn_exim.utils.before_app_install"
# after_app_install = "cn_exim.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "cn_exim.utils.before_app_uninstall"
# after_app_uninstall = "cn_exim.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "cn_exim.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {
    "Bill of Entry": "cn_exim.config.py.bill_of_entry_override.BillofEntry",
}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
    "Supplier Quotation": {
        "validate": "cn_exim.cn_exim.api.validate_date",
        "before_insert": "cn_exim.config.py.supplier_quotation.update_rfq_status",
        "on_submit": "cn_exim.config.py.supplier_quotation.update_rfq_status",
        "on_cancel": "cn_exim.config.py.supplier_quotation.update_rfq_status"
    },
    "Journal Entry": {
        "on_cancel": "cn_exim.cn_exim.doc_events.journal_entry.on_cancel"
    },
    "EMD":{
        "validate": "cn_exim.cn_exim.doctype.emd.emd.validate"
    },
    "Purchase Receipt":{
        "on_submit": "cn_exim.overrides.purchase_receipt.on_submit"
    },
    "Purchase Order": {
        "on_trash": "cn_exim.cn_exim.doc_events.purchase_order.on_trash",
    },
    "Request for Quotation": {
        "on_trash": "cn_exim.cn_exim.doc_events.rfq_event.on_trash",
    },
}

# Scheduled Tasks
# ---------------
scheduler_events = {
    "weekly": ["cn_exim.cn_exim.doctype.emd.emd.send_emails"],
    "daily": ["cn_exim.cn_exim.doctype.emd.emd.change_status_on_due"],
}

# Testing
# -------

# before_tests = "cn_exim.install.before_tests"

# Overriding Methods
# ------------------------------
#

# override_whitelisted_methods = {
# }

#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "cn_exim.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["cn_exim.utils.before_request"]
# after_request = ["cn_exim.utils.after_request"]

# Job Events
# ----------
# before_job = ["cn_exim.utils.before_job"]
# after_job = ["cn_exim.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"cn_exim.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }


