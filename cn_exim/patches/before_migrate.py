import frappe

def execute():
    """
    Before migrate script to add custom field in Stock Settings
    for allowing stock quantity updation in Material Request Item
    """

    # Add custom field to Stock Settings
    add_stock_settings_field()

    # Add GRN Gate Entry field to Stock Settings
    add_grn_gate_entry_field()

def add_stock_settings_field():
    """
    Add checkbox field 'allow_stock_qty_updation' to Stock Settings DocType
    """
    try:
        # Check if field already exists
        existing_field = frappe.db.exists("Custom Field", {
            "dt": "Stock Settings",
            "fieldname": "allow_stock_qty_updation"
        })

        if not existing_field:
            # Create custom field
            custom_field = frappe.get_doc({
                "doctype": "Custom Field",
                "dt": "Stock Settings",
                "label": "Allow Stock Qty Updation",
                "fieldname": "allow_stock_qty_updation",
                "fieldtype": "Check",
                "insert_after": "allow_internal_transfer_at_arms_length_price",
                "description": "If enabled, qty and stock_qty will always remain same in Material Request Item",
                "default": 1,
                "reqd": 0,
                "read_only": 0,
                "hidden": 0,
                "print_hide": 1,
                "report_hide": 0,
                "allow_on_submit": 0,
                "translatable": 0
            })

            custom_field.insert()
            frappe.db.commit()

            print("✓ Added 'Allow Stock Qty Updation' field to Stock Settings")
    except Exception as e:
        print(f"✗ Error adding field to Stock Settings: {str(e)}")
        frappe.log_error(f"Error in before_migrate.py: {str(e)}", "Stock Settings Field Addition")

def add_grn_gate_entry_field():
    """
    Add select field 'allow_grn_without_gate_entry' to Stock Settings DocType
    """
    try:
        # Check if field already exists
        existing_field = frappe.db.exists("Custom Field", {
            "dt": "Buying Settings",
            "fieldname": "allow_grn_without_gate_entry"
        })

        if not existing_field:
            # Create custom field
            custom_field = frappe.get_doc({
                "doctype": "Custom Field",
                "dt": "Buying Settings",
                "label": "Allow GRN Without Gate Entry",
                "fieldname": "allow_grn_without_gate_entry",
                "fieldtype": "Select",
                "options": "Yes\nNo",
                "insert_after": "mandate_supplier_quotation_attachment",
                "description": "If set to No, Gate Entry will be mandatory before creating Purchase Receipt/GRN",
                "default": "No",
                "reqd": 0,
                "read_only": 0,
                "hidden": 0,
                "print_hide": 1,
                "report_hide": 0,
                "allow_on_submit": 0,
                "translatable": 0
            })

            custom_field.insert()
            frappe.db.commit()

            print("✓ Added 'Allow GRN Without Gate Entry' field to Buying Settings")
        

    except Exception as e:
        print(f"✗ Error adding GRN Gate Entry field to Stock Settings: {str(e)}")
        frappe.log_error(f"Error adding GRN Gate Entry field: {str(e)}", "Stock Settings GRN Field Addition")