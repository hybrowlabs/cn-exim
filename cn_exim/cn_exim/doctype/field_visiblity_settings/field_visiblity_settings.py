# Copyright (c) 2025, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _

class FieldVisiblitySettings(Document):
    pass


@frappe.whitelist()
def get_field_visibility_settings(doctype_name):
    """
    Dynamically fetch all field visibility settings for a doctype
    Returns dict with field names and their visibility status (1 = hide, 0 = show)
    """
    try:
        # Get the Field Visibility Settings document
        settings_doc = frappe.get_doc("Field Visiblity Settings", {"doctype_name": doctype_name})
        
        # Get all fields from the settings doctype that are checkboxes
        meta = frappe.get_meta("Field Visiblity Settings")
        checkbox_fields = [f.fieldname for f in meta.fields if f.fieldtype == "Check"]
        
        # Build response with all checkbox field values
        result = {}
        for fieldname in checkbox_fields:
            # Get the value (1 = hide field, 0 = show field)
            result[fieldname] = settings_doc.get(fieldname) or 0
        
        return result
        
    except frappe.DoesNotExistError:
        # If no settings exist, return empty dict (all fields visible by default)
        frappe.log_error(f"No Field Visibility Settings found for {doctype_name}")
        return {}
    except Exception as e:
        frappe.log_error(f"Error fetching field visibility settings: {str(e)}")
        return {}


def apply_field_visibility_on_load(doc, method=None):
    """
    Apply field visibility on document load
    This modifies field properties in the meta
    
    Add to hooks.py:
    doc_events = {
        "Request for Quotation": {
            "onload": "cn_exim.cn_exim.doctype.field_visiblity_settings.field_visiblity_settings.apply_field_visibility_on_load"
        }
    }
    """
    print("----------------------55----------------")
    try:
        # Get field visibility settings
        settings = frappe.db.get_value(
            "Field Visiblity Settings",
            {"doctype_name": doc.doctype},
            "*",
            as_dict=True
        )
        
        if not settings:
            return
        
        # Get the doctype meta
        meta = frappe.get_meta(doc.doctype)
        
        # Get all checkbox fields from Field Visiblity Settings
        settings_meta = frappe.get_meta("Field Visiblity Settings")
        checkbox_fields = [f.fieldname for f in settings_meta.fields if f.fieldtype == "Check"]
        
        # Apply visibility rules dynamically
        for fieldname in checkbox_fields:
            # Check if field exists in target doctype
            field = meta.get_field(fieldname)
            if field and fieldname in settings:
                should_hide = settings.get(fieldname, 0)
                
                # If checkbox is checked (1), hide the field and make it non-mandatory
                # If checkbox is unchecked (0), show the field
                field.hidden = 1 if should_hide else 0
                field.reqd = 0 if should_hide else field.reqd  # Don't force mandatory, just remove if hidden
                
    except Exception as e:
        frappe.log_error(f"Error applying field visibility on load: {str(e)}")


def validate_visible_fields(doc, method=None):
    """
    Validate that visible mandatory fields have values
    Hidden fields are automatically exempted from validation
    
    Add to hooks.py:
    doc_events = {
        "Request for Quotation": {
            "validate": "cn_exim.cn_exim.doctype.field_visiblity_settings.field_visiblity_settings.validate_visible_fields"
        }
    }
    """
    print("-----------------103--------------------------")
    try:
        # Get field visibility settings
        settings = frappe.db.get_value(
            "Field Visiblity Settings",
            {"doctype_name": doc.doctype},
            "*",
            as_dict=True
        )
        
        if not settings:
            return
        
        # Get meta
        meta = frappe.get_meta(doc.doctype)
        
        # Get all checkbox fields from settings
        settings_meta = frappe.get_meta("Field Visiblity Settings")
        checkbox_fields = [f.fieldname for f in settings_meta.fields if f.fieldtype == "Check"]
        
        # Check mandatory fields that are NOT hidden
        for fieldname in checkbox_fields:
            field = meta.get_field(fieldname)
            if field:
                should_hide = settings.get(fieldname, 0)
                
                # If field is NOT hidden and is mandatory and empty, throw error
                if not should_hide and field.reqd and not doc.get(fieldname):
                    frappe.throw(_(f"{field.label} is mandatory"))
                
                # If field IS hidden, clear its value to avoid conflicts
                if should_hide:
                    doc.set(fieldname, None)
                    
    except Exception as e:
        frappe.log_error(f"Error validating visible fields: {str(e)}")
        raise


def clear_hidden_field_values(doc, method=None):
    """
    Clear values of hidden fields before save
    
    Add to hooks.py:
    doc_events = {
        "Request for Quotation": {
            "before_save": "cn_exim.cn_exim.doctype.field_visiblity_settings.field_visiblity_settings.clear_hidden_field_values"
        }
    }
    """
    try:
        # Get field visibility settings
        settings = frappe.db.get_value(
            "Field Visiblity Settings",
            {"doctype_name": doc.doctype},
            "*",
            as_dict=True
        )
        
        if not settings:
            return
        
        # Get all checkbox fields from settings
        settings_meta = frappe.get_meta("Field Visiblity Settings")
        checkbox_fields = [f.fieldname for f in settings_meta.fields if f.fieldtype == "Check"]
        
        # Clear hidden fields
        for fieldname in checkbox_fields:
            should_hide = settings.get(fieldname, 0)
            if should_hide and doc.get(fieldname):
                doc.set(fieldname, None)
                
    except Exception as e:
        frappe.log_error(f"Error clearing hidden field values: {str(e)}")