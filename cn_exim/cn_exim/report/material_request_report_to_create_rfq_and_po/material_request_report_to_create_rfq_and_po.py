# Copyright (c) 2025, Prathamesh Jadhav and contributors
# For license information, please see license.txt
#DOnt show items where the rfq is created and in draft or submitted
import frappe
from frappe import _
from cn_exim.utils import get_last_purchase_details_with_supplier

def execute(filters=None):
	columns, data = get_columns(filters), get_data(filters)
	return columns, data


def get_columns(filters=None):
	if filters and filters.get("docstatus") == "0":
		columns = [
			{"label": "Create PO", "fieldname": "create_po", "fieldtype": "Check", "width": 35},
			{"label": "Material Request", "fieldname": "material_request", "fieldtype": "Link", "options": "Material Request", "width": 200},
			{"label": "Item Code", "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 150},
            {"label": "Item Description", "fieldname": "description", "fieldtype": "Small Text","width": 150},
			{"label": "UOM", "fieldname": "uom", "fieldtype": "Link", "options": "UOM", "width": 100},
            {"label": "MR Qty", "fieldname": "mr_qty", "fieldtype": "Float", "width": 100},
			{"label": "Last Supplier", "fieldname": "last_supplier", "fieldtype": "Data", "width": 150},
            {"label": "Last Purchase Rate", "fieldname": "last_purchase_rate", "fieldtype": "Currency", "width": 150},
            {"label": "Lead Time", "fieldname": "lead_time", "fieldtype": "Int", "width": 100},
            {"label": "MOQ", "fieldname": "moq", "fieldtype": "Float", "width": 100},
			{"label": "Item Info", "fieldname": "item_info", "fieldtype": "Data", "width": 100}
		]
	else:
		columns = [
			{"label": "Create PO", "fieldname": "create_po", "fieldtype": "Check", "width": 35},
			{"label": "Material Request", "fieldname": "material_request", "fieldtype": "Link", "options": "Material Request", "width": 200},
			{"label": "Item Code", "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 150},
            {"label": "Item Description", "fieldname": "description", "fieldtype": "Small Text","width": 150},
			{"label": "UOM", "fieldname": "uom", "fieldtype": "Link", "options": "UOM", "width": 100},
            {"label": "MR Qty", "fieldname": "mr_qty", "fieldtype": "Float", "width": 100},
			{"label": "Last Supplier", "fieldname": "last_supplier", "fieldtype": "Data", "width": 150},
			{"label": "Last Purchase Rate", "fieldname": "last_purchase_rate", "fieldtype": "Currency", "width": 150},
            {"label": "Lead Time", "fieldname": "lead_time", "fieldtype": "Int", "width": 100},
            {"label": "MOQ", "fieldname": "moq", "fieldtype": "Float", "width": 100},
			# {"label": "RFQ Qty", "fieldname": "total_rfq_qty", "fieldtype": "Float", "width": 100},
			# {"label": "Qty Difference", "fieldname": "quantity", "fieldtype": "Float", "width": 120},
			{"label": "Item Info", "fieldname": "item_info", "fieldtype": "Data", "width": 100}
		]
	
	# Add workflow state column only for submitted MRs when checkbox is checked
	if filters and filters.get("show_workflow_state") and filters.get("docstatus") == "1":
		workflow_column = {"label": "Workflow State", "fieldname": "workflow_state", "fieldtype": "Data", "width": 120}
		columns.insert(-1, workflow_column)  # Insert before Item Info
	
	return columns


        
        
def get_data(filters):
    conditions = []
    values = {}
    docstatus = filters.get("docstatus")
    if docstatus in ["0", "1"]:  
        conditions.append("mr.docstatus = %(docstatus)s")
        values["docstatus"] = int(docstatus)


    if filters.get("material_request"):
        mr_list = frappe.parse_json(filters.get("material_request"))
        if isinstance(mr_list, str):
            mr_list = [mr.strip() for mr in mr_list.split(",")]
        conditions.append("mr.name IN %(material_request)s")
        values["material_request"] = mr_list

    if filters.get("item_code"):
        item_list = frappe.parse_json(filters.get("item_code"))
        if isinstance(item_list, str):
            item_list = [mr.strip() for mr in item_list.split(",")]
        conditions.append("mr_item.item_code IN %(item_code)s")
        values["item_code"] = item_list

    if filters.get("transaction_date"):
        conditions.append("mr.transaction_date = %(transaction_date)s")
        values["transaction_date"] = filters.get("transaction_date")

    if filters.get("company"):
        conditions.append("mr.company = %(company)s")
        values["company"] = filters.get("company")

    # Add workflow state filter only for submitted MRs when checkbox is checked
    if filters.get("show_workflow_state") and filters.get("docstatus") == "1":
        conditions.append("mr.workflow_state = 'Approved'")
    
    # Add workflow state filter for Approval Pending option
    if filters.get("docstatus") == "2":
        conditions.append("mr.workflow_state = 'Submitted'")
        conditions.append("mr.docstatus = 1")

    condition_str = " AND " + " AND ".join(conditions) if conditions else ""
    
    # Check if workflow state column is needed (only for submitted MRs)
    show_workflow_state = filters.get("show_workflow_state") and filters.get("docstatus") == "1"
    
    if docstatus == "1":
        workflow_select = ", mr.workflow_state" if show_workflow_state else ""
        query = f"""
            SELECT
                mr_item.name AS mr_item_name,
                mr.name AS material_request,
                mr_item.item_code AS item_code,
                mr_item.uom AS uom,
                mr_item.qty AS mr_qty,
                IFNULL(rfq_item.total_rfq_qty, 0) AS total_rfq_qty,
                (IFNULL(rfq_item.total_rfq_qty, 0) - mr_item.qty) AS quantity{workflow_select}
            FROM
                `tabMaterial Request Item` AS mr_item
            INNER JOIN
                `tabMaterial Request` AS mr ON mr.name = mr_item.parent
            LEFT JOIN (
                SELECT
                    material_request_item,
                    SUM(qty) AS total_rfq_qty
                FROM (
                    SELECT DISTINCT parent, material_request_item, qty
                    FROM `tabRequest for Quotation Item`
                ) AS unique_rfq
                GROUP BY material_request_item
            ) AS rfq_item ON rfq_item.material_request_item = mr_item.name
            WHERE
                mr.docstatus = 1
                AND mr.material_request_type != 'Material Transfer'
                AND (mr_item.custom_po_created = 0 OR mr_item.custom_po_created IS NULL)
                AND NOT EXISTS (
                    SELECT 1
                    FROM `tabRequest for Quotation Item` rfq_item
                    INNER JOIN `tabRequest for Quotation` rfq ON rfq.name = rfq_item.parent
                    WHERE rfq.docstatus IN (0, 1)
                    AND rfq_item.material_request_item = mr_item.name
                )
                {condition_str}
            ORDER BY mr.transaction_date DESC
        """
    else:
         query = f"""
            SELECT
                mr_item.name AS mr_item_name,
                mr.name AS material_request,
                mr_item.item_code AS item_code,
                mr_item.uom AS uom,
                mr_item.qty AS mr_qty
            FROM
                `tabMaterial Request Item` AS mr_item
            INNER JOIN
                `tabMaterial Request` AS mr ON mr.name = mr_item.parent
            WHERE
                mr.material_request_type != 'Material Transfer'
                AND (mr_item.custom_po_created = 0 OR mr_item.custom_po_created IS NULL)
                {condition_str}
            ORDER BY mr.transaction_date DESC
        """

    raw_data = frappe.db.sql(query, values, as_dict=True)

    for row in raw_data:
        row["item_info"] = f"<button class='btn btn-sm btn-info item-info-btn' data-item='{row.get('item_code')}'>i</button>"
        last_info = get_last_purchase_details_with_supplier(row.get("item_code"))
        row["last_supplier"] = frappe.db.get_value("Supplier",last_info.get("supplier"),"supplier_name") or ""
        row["last_purchase_rate"] = last_info.get("rate") or 0
        last_supplier = last_info.get("supplier")
        sii = frappe.db.get_value(
            "Item Supplier",
            {"parent": row.get("item_code"), "supplier": last_supplier},
            ["custom_lead_time", "custom_minimum_order_qty"],
            as_dict=True
        ) or {}

        row["lead_time"] = sii.get("custom_lead_time") or 0
        row["moq"] = sii.get("custom_minimum_order_qty") or 0
        row["mr_item_name"] = row.get("mr_item_name")
        row["description"] = frappe.db.get_value("Item", row.get("item_code"), "description") or ""
        
    return raw_data



@frappe.whitelist()
def create_rfqs_from_simple_data(items):
    items = frappe.parse_json(items)
    supplier_items_map = {}

    for item in items:
        item_code = item.get("item_code")
        material_request = item.get("material_request")

        if not item_code or not material_request:
            continue

        # Get suppliers for this item
        suppliers = frappe.db.sql(
            """
            SELECT supplier 
            FROM `tabItem Supplier` 
            WHERE parent = %s
            """,
            (item_code,),
            as_dict=True,
        )
        

        # Fetch data from Material Request Item if necessary
        mri_data = {}

        if item.get("material_request_item"):
            mri_data = frappe.db.get_value(
                "Material Request Item",
                item.get("material_request_item"),
                [
                    "name", "uom", "item_name", "schedule_date", "description",
                    "item_group", "brand", "stock_uom", "conversion_factor", "warehouse"
                ],
                as_dict=True
            ) or {}
        else:
            mri_data = frappe.db.get_value(
                "Material Request Item",
                {"item_code": item_code, "parent": material_request},
                [
                    "name", "uom", "item_name", "schedule_date", "description",
                    "item_group", "brand", "stock_uom", "conversion_factor", "warehouse"
                ],
                as_dict=True
            ) or {}

        if not suppliers:
            if "missing_suppliers" not in frappe.local.flags:
                frappe.local.flags.missing_suppliers = []
            frappe.local.flags.missing_suppliers.append(f"{item_code} in {material_request}")
            continue

        for supplier in suppliers:
            supplier_name = supplier.get("supplier")
            if not supplier_name:
                continue

            if supplier_name not in supplier_items_map:
                supplier_items_map[supplier_name] = []

            supplier_items_map[supplier_name].append({
                "item_code": item_code,
                "qty": item.get("qty") or 1,
                "uom": item.get("uom") or mri_data.get("uom") or "Nos",
                "material_request": material_request,
                "material_request_item": item.get("material_request_item") or mri_data.get("name"),
                "item_name": item.get("item_name") or mri_data.get("item_name"),
                "schedule_date": item.get("schedule_date") or mri_data.get("schedule_date"),
                "description": item.get("description") or mri_data.get("description"),
                "item_group": item.get("item_group") or mri_data.get("item_group"),
                "brand": item.get("brand") or mri_data.get("brand"),
                "stock_uom": item.get("stock_uom") or mri_data.get("stock_uom"),
                "conversion_factor": item.get("conversion_factor") or mri_data.get("conversion_factor"),
                "warehouse": item.get("warehouse") or mri_data.get("warehouse"),
            })


    rfq_names = []

    for supplier, item_list in supplier_items_map.items():
        material_request = item_list[0]["material_request"]
        # Check if RFQ already exists for the specific supplier + item
        skip_supplier = True
        for item in item_list:
            exists = frappe.db.exists(
                "Request for Quotation Item",
                {
                    "supplier": supplier,
                    "material_request_item": item["material_request_item"],
                    "docstatus": ["!=", 2]
                }
            )
            if not exists:
                skip_supplier = False
                break

        if skip_supplier:
            frappe.msgprint(
                f"RFQ already exists for all items of supplier {supplier} in material request {material_request}. Skipping RFQ creation."
            )
            continue

        # Create RFQ
        rfq = frappe.new_doc("Request for Quotation")
        rfq.append("suppliers", {"supplier": supplier})
        rfq.message_for_supplier = "Kindly quote your best rates for the following items."
        rfq.custom_type = "Material"
        rfq.custom_plant = frappe.db.get_value("Material Request", material_request, "custom_plant")
        rfq.schedule_date = frappe.db.get_value("Material Request", material_request, "schedule_date")
        rfq.custom_validity_start_date = frappe.utils.nowdate()
        rfq.custom_validity_end_date = frappe.utils.add_days(frappe.utils.nowdate(), 7)
        rfq.custom_quotation_deadline = frappe.utils.add_days(frappe.utils.nowdate(), 7)
        user = frappe.session.user
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        if employee:
            rfq.custom_requestor_name = employee

        for item in item_list:
            rfq.append("items", {
                "item_code": item["item_code"],
                "qty": item["qty"],
                "uom": item["uom"],
                "material_request": item["material_request"],
                "material_request_item": item["material_request_item"],
                "item_name": item["item_name"],
                "schedule_date": item["schedule_date"],
                "description": item["description"],
                "item_group": item["item_group"],
                "brand": item["brand"],
                "stock_uom": item["stock_uom"],
                "conversion_factor": item["conversion_factor"],
                "warehouse": item["warehouse"],
                "custom_plant_code":rfq.custom_plant,
            })
		
        rfq.insert()
        rfq_names.append(rfq.name)
    if hasattr(frappe.local.flags, "missing_suppliers") and frappe.local.flags.missing_suppliers:
        msg = "<br>".join(frappe.local.flags.missing_suppliers)
        frappe.msgprint(f"RFQ skipped for the following due to missing supplier:<br><br>{msg}")

    return {"rfqs": rfq_names}



@frappe.whitelist()
def create_pos_from_simple_data(items):
    items = frappe.json.loads(items)
    
    mr_item_list = []
    for item in items:
        mr_data =  frappe.db.get_value(
			"Material Request Item",
			{"parent": item.get("material_request"), "item_code": item.get("item_code")},
			["name", "uom", "item_code", "item_name", "schedule_date", "description", "item_group", "brand", "stock_uom", "conversion_factor", "warehouse", "qty", "rate", "parent", "ordered_qty"],
			as_dict=True
		) or {}
        
        
        mr_item_list.append(mr_data)
    company = frappe.get_value("Material Request", item.get("material_request"), "company")
    return mr_item_list, company

@frappe.whitelist()
def get_supplier_item_details(item_code):
    if not item_code:
        return {"message": "Item Code is required"}

    item = frappe.get_doc("Item", item_code)
    supplier_items = item.get("supplier_items")

    if not supplier_items:
        return {"message": "Please update Item Master. No supplier items found."}

    data = []
    for row in supplier_items:
        supplier_name = frappe.db.get_value("Supplier", row.supplier, "supplier_name") or ""
        data.append({
            "supplier": row.supplier,
            "supplier_name": supplier_name,
            "custom_minimum_order_qty": row.custom_minimum_order_qty or 0
        })

    return {"data": data}

@frappe.whitelist()
def update_material_request_qty(material_request, item_code, qty):
    mri = frappe.db.get_value(
        "Material Request Item",
        {"parent": material_request, "item_code": item_code},
        "name"
    )
    if not mri:
        frappe.throw("Material Request Item not found.")
 
    mri_doc = frappe.get_doc("Material Request Item", mri)
    mri_doc.qty = qty
    mri_doc.save()

    mr_doc = frappe.get_doc("Material Request", material_request)
    mr_doc.save() 

    frappe.db.commit()
    return True

import frappe

@frappe.whitelist()
def submit_selected_material_requests(mr_selections):
    """Receives a dict: { 'MR-XXXXX': [mr_item_name1, mr_item_name2, ...], ... }
    Shows both selected and missing items (with code & name) if MR is incomplete."""
    mr_selections = frappe.parse_json(mr_selections)
    success_mrs = []
    incomplete_mrs = []

    for mr, selected_mr_item_names in mr_selections.items():
        # All item rows for this MR
        all_mr_items = frappe.get_all(
            "Material Request Item",
            filters={"parent": mr},
            fields=["name", "item_code", "item_name"],
        )
        all_items_by_name = {i["name"]: i for i in all_mr_items}
        all_names_set = set(all_items_by_name.keys())
        selected_names_set = set(selected_mr_item_names)

        # Selected/missing ke lists bana lo
        selected_list = [all_items_by_name[n] for n in selected_names_set if n in all_items_by_name]
        missing_list = [all_items_by_name[n] for n in all_names_set - selected_names_set]

        if selected_names_set == all_names_set:
            # All rows selected, submit
            try:
                mr_doc = frappe.get_doc("Material Request", mr)
                if mr_doc.docstatus == 0:
                    if mr_doc.company == "ELVENTIVE TECH PVT LTD":
                        mr_doc.submit()
                        mr_doc.workflow_state = "Approval pending from  Planner"
                        mr_doc.save()
                    else:
                        mr_doc.submit()
                        mr_doc.workflow_state = "Approval pending from  Planner"
                        mr_doc.save()
                    success_mrs.append(mr)
            except Exception as e:
                incomplete_mrs.append(
                    f"<b>{mr} submit failed:</b> {frappe.utils.cstr(e)}"
                )
        else:
            # Selected Items Block
            selected_html = (
                "<b>Selected Items:</b>"
                "<ul>"
                + "".join(
                    f"<li><b>{i['item_code'] or ''}</b>: {i['item_name'] or ''}</li>"
                    for i in selected_list
                )
                + "</ul>"
            )
            # Missing Items Block
            missing_html = (
                "<b>Missing Items:</b>"
                "<ul>"
                + "".join(
                    f"<li><b>{i['item_code'] or ''}</b>: {i['item_name'] or ''}</li>"
                    for i in missing_list
                )
                + "</ul>"
            )
            incomplete_mrs.append(
                f"""<b>Material Request 
                <a href='/app/material-request/{mr}' target='_blank'>{mr}</a> not submitted.</b>
                <br>Select all items before submission.<br><br>
                {selected_html}
                {missing_html}"""
            )

    return {
        "success_mrs": success_mrs,
        "incomplete_mrs": incomplete_mrs
    }

@frappe.whitelist()
def check_user_buyer_role_for_elventive(company=None):
    """Check if user has buyer role only for ELVENTIVE TECH PVT LTD company"""
    try:
        # If company is not ELVENTIVE TECH PVT LTD, always show buttons
        if company != "ELVENTIVE TECH PVT LTD":
            return {"show_buttons": True, "reason": "not_elventive_company"}
        
        # Get current user roles
        user_roles = frappe.get_roles()
        
        # Get buyer roles from Custom Settings
        custom_settings = frappe.get_single("Custom Settings")
        buyer_roles = []
        
        if hasattr(custom_settings, 'elev_buyer_role') and custom_settings.elev_buyer_role:
            buyer_roles = [role.role for role in custom_settings.elev_buyer_role]
        
        # Check if user has any buyer role
        has_buyer_role = any(role in user_roles for role in buyer_roles)
        
        return {
            "show_buttons": has_buyer_role,
            "has_buyer_role": has_buyer_role,
            "user_roles": user_roles,
            "buyer_roles": buyer_roles,
            "reason": "elventive_company_check"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in check_user_buyer_role_for_elventive: {str(e)}")
        return {
            "show_buttons": True,  # Default to show buttons on error
            "error": str(e)
        }

@frappe.whitelist()
def send_for_approval(mr_selections):
    """Send selected Material Requests for approval"""
    mr_selections = frappe.parse_json(mr_selections)
    success_mrs = []
    error_mrs = []

    for mr, selected_mr_item_names in mr_selections.items():
        try:
            # Get the Material Request document
            mr_doc = frappe.get_doc("Material Request", mr)
            
            # Check if MR is in correct state (submitted with workflow_state = 'Submitted')
            if mr_doc.docstatus != 1:
                error_mrs.append(f"<b>{mr}</b>: Material Request is not submitted")
                continue
                
            if mr_doc.workflow_state != 'Submitted':
                error_mrs.append(f"<b>{mr}</b>: Material Request is not in 'Submitted' state")
                continue
            
            # Update workflow state to next approval level
            mr_doc.workflow_state = "Approval pending from  Planner"
            mr_doc.save()
            frappe.db.commit()
            
            success_mrs.append(mr)
            
        except Exception as e:
            error_mrs.append(f"<b>{mr}</b>: {frappe.utils.cstr(e)}")

    return {
        "success_mrs": success_mrs,
        "error_mrs": error_mrs
    }

@frappe.whitelist()
def check_user_planner_role_for_elventive(company=None):
    """Check if user has planner role only for ELVENTIVE TECH PVT LTD company"""
    try:
        # If company is not ELVENTIVE TECH PVT LTD, always show buttons
        if company != "ELVENTIVE TECH PVT LTD":
            return {"show_buttons": True, "reason": "not_elventive_company"}
        
        # Get current user roles
        user_roles = frappe.get_roles()
        
        # Get planner roles from Custom Settings
        custom_settings = frappe.get_single("Custom Settings")
        planner_roles = []
        
        if hasattr(custom_settings, 'elev_planner_role') and custom_settings.elev_planner_role:
            planner_roles = [role.role for role in custom_settings.elev_planner_role]
        
        # Check if user has any planner role
        has_planner_role = any(role in user_roles for role in planner_roles)
        
        return {
            "show_buttons": has_planner_role,
            "has_planner_role": has_planner_role,
            "user_roles": user_roles,
            "planner_roles": planner_roles,
            "reason": "elventive_company_check"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in check_user_planner_role_for_elventive: {str(e)}")
        return {
            "show_buttons": True,  # Default to show buttons on error
            "error": str(e)
        }
