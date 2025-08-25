import frappe

@frappe.whitelist()
def get_item_charges(name):
    data = frappe.db.sql("""
                SELECT ict.*, mt.item_charges
                FROM `tabItem Charges Template` ict
                JOIN `tabMaterial Types` mt ON ict.parent = mt.name
                WHERE ict.parent = %s
    """, (name,), as_dict=True)

    return data


@frappe.whitelist()
def get_item_charges_from_item_group(name):
    data = frappe.db.sql("""
                SELECT ict.*, ig.custom_item_charge
                FROM `tabItem Charges Template` ict
                JOIN `tabItem Group` ig ON ict.parent = ig.name
                WHERE ict.parent = %s
    """, (name,), as_dict=True)

    return data

@frappe.whitelist()
def get_default_account(name):
    data = frappe.db.sql(" select * from `tabMaterial Type Account` where parent=%s ",(name), as_dict=True)
    
    return data

@frappe.whitelist()
def create_putaway_rule_from_material_types(item_code, material_type):
    """Create Putaway Rule based on Material Types configuration"""
    try:
        # Get Material Types record
        material_type_doc = frappe.get_doc("Material Types", material_type)
        
        if not material_type_doc.is_putaway_configuration:
            return {"success": False, "message": "Putaway Configuration is not enabled for this Material Type"}
        
        # Check if Putaway Rule already exists
        existing_rule = frappe.db.exists(
            "Putaway Rule", 
            {
                "item_code": item_code,
                "warehouse": material_type_doc.warehouse
            }
        )
        
        if existing_rule:
            return {"success": False, "message": "Putaway Rule already exists for this item and warehouse"}
        
        # Create new Putaway Rule
        putaway_rule = frappe.new_doc("Putaway Rule")
        putaway_rule.item_code = item_code
        putaway_rule.item_name = frappe.db.get_value("Item", item_code, "item_name")
        putaway_rule.warehouse = material_type_doc.warehouse
        putaway_rule.priority = 1
        putaway_rule.company = material_type_doc.company
        putaway_rule.capacity = material_type_doc.capacity
        putaway_rule.stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
        putaway_rule.disable = 0
        
        # Add shelf field if it exists in Material Types
        if hasattr(material_type_doc, 'shelf') and material_type_doc.shelf:
            putaway_rule.shelf = material_type_doc.shelf
        
        putaway_rule.insert(ignore_permissions=True)
        
        putaway_link = frappe.utils.get_link_to_form("Putaway Rule", putaway_rule.name)
        return {"success": True, "message": f"Putaway Rule created successfully! {putaway_link}"}
        
    except Exception as e:
        frappe.log_error(f"Error creating Putaway Rule from Material Types: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def create_custom_putaway_rule(item_code, item_name, warehouse, capacity, priority, stock_uom, shelf=None):
    """Create custom Putaway Rule with manual entry"""
    try:
        # Check if Putaway Rule already exists
        existing_rule = frappe.db.exists(
            "Putaway Rule", 
            {
                "item_code": item_code,
                "warehouse": warehouse
            }
        )
        
        if existing_rule:
            return {"success": False, "message": "Putaway Rule already exists for this item and warehouse"}
        
        # Get company from warehouse
        company = frappe.db.get_value("Warehouse", warehouse, "company")
        if not company:
            return {"success": False, "message": f"Company not found for warehouse {warehouse}"}
        
        # Validate shelf is provided and belongs to warehouse
        if not shelf:
            return {"success": False, "message": "Shelf is mandatory. Please select a shelf."}
        
        shelf_warehouse = frappe.db.get_value("Shelf", shelf, "warehouse")
        if not shelf_warehouse:
            return {"success": False, "message": f"Shelf {shelf} does not exist."}
        
        if shelf_warehouse != warehouse:
            return {"success": False, "message": f"Shelf {shelf} does not belong to warehouse {warehouse}"}
        
        # Create new Putaway Rule
        putaway_rule = frappe.new_doc("Putaway Rule")
        putaway_rule.item_code = item_code
        putaway_rule.item_name = item_name
        putaway_rule.warehouse = warehouse
        putaway_rule.priority = priority
        putaway_rule.company = company  # Auto-fetched from warehouse
        putaway_rule.capacity = capacity
        putaway_rule.stock_uom = stock_uom
        putaway_rule.disable = 0
        putaway_rule.shelf = shelf  # Mandatory field
        
        putaway_rule.insert(ignore_permissions=True)
        
        putaway_link = frappe.utils.get_link_to_form("Putaway Rule", putaway_rule.name)
        return {"success": True, "message": f"Custom Putaway Rule created successfully! {putaway_link}"}
        
    except Exception as e:
        frappe.log_error(f"Error creating custom Putaway Rule: {str(e)}")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def bulk_create_putaway_rules_from_material_types(item_names=None):
    """Create Putaway Rules for items (selected or all in view) that don't have one, using their Material Type config.
    Accepts item_names as list or JSON string; if None, processes all items having custom_material_type.
    Returns summary with created, skipped, errors arrays.
    """
    created, skipped, errors = [], [], []

    # Normalize input: list or JSON string or None
    if isinstance(item_names, str):
        try:
            import json as _json
            item_names = _json.loads(item_names)
        except Exception:
            item_names = []
    elif not isinstance(item_names, list):
        item_names = [] if item_names is None else list(item_names)

    items = []
    if item_names:
        items = frappe.get_all('Item', filters={'name': ['in', item_names]}, fields=['name', 'custom_material_type', 'stock_uom', 'item_name'])
    else:
        items = frappe.get_all('Item', filters={'custom_material_type': ['is', 'set']}, fields=['name', 'custom_material_type', 'stock_uom', 'item_name'])

    for it in items:
        try:
            if not it.custom_material_type:
                skipped.append(it.name)
                continue

            mt = frappe.get_doc('Material Types', it.custom_material_type)
            if not getattr(mt, 'is_putaway_configuration', False):
                skipped.append(it.name)
                continue
            if not mt.warehouse or not mt.capacity or not mt.company:
                skipped.append(it.name)
                continue

            exists = frappe.db.exists('Putaway Rule', {
                'item_code': it.name,
                'warehouse': mt.warehouse
            })
            if exists:
                skipped.append(it.name)
                continue

            rule = frappe.new_doc('Putaway Rule')
            rule.item_code = it.name
            rule.item_name = it.item_name
            rule.warehouse = mt.warehouse
            rule.priority = 1
            rule.company = mt.company
            rule.capacity = mt.capacity
            rule.stock_uom = it.stock_uom
            if getattr(mt, 'shelf', None):
                try:
                    rule.shelf = mt.shelf
                except Exception:
                    pass
            rule.insert(ignore_permissions=True)
            created.append(rule.name)
        except Exception as e:
            errors.append({'item': it.name, 'error': str(e)})

    return {
        'created': created,
        'skipped': skipped,
        'errors': errors,
    }

def validate_putaway_configuration(doc, method):
    """
    Validate putaway configuration before item insertion/update
    """
    if doc.custom_material_type:
        # Get Material Types record
        material_type = frappe.get_doc("Material Types", doc.custom_material_type)
        
        # Check if Material Type exists
        if not material_type:
            frappe.throw(
                f"Selected Material Type '{doc.custom_material_type}' does not exist.",
                title="Invalid Material Type"
            )
        
        # Check if putaway configuration is enabled for this Material Type
        if material_type.is_putaway_configuration:
            missing_fields = []
            if not material_type.warehouse:
                missing_fields.append("Warehouse")
            if not material_type.shelf:
                missing_fields.append("Shelf")
            if not material_type.capacity or material_type.capacity <= 0:
                missing_fields.append("Capacity")
            if not material_type.company:
                missing_fields.append("Company")
            
            if missing_fields:
                frappe.throw(f"Missing fields in Material Type '{doc.custom_material_type}': {', '.join(missing_fields)}")

def create_putaway_rule_from_material_type(doc, method):
    """
    Automatically create Putaway Rule when Item is inserted
    based on custom_material_type field
    """
    if method == "after_insert" and doc.custom_material_type:
        try:
            # Get Material Types record
            material_type = frappe.get_doc("Material Types", doc.custom_material_type)
            
            # Only create Putaway Rule if putaway configuration is enabled
            if material_type.is_putaway_configuration and material_type.warehouse:
                # Check if Putaway Rule already exists
                existing_rule = frappe.db.exists(
                    "Putaway Rule", 
                    {
                        "item_code": doc.item_code,
                        "warehouse": material_type.warehouse
                    }
                )
                
                if not existing_rule:
                    # Create new Putaway Rule
                    putaway_rule = frappe.new_doc("Putaway Rule")
                    putaway_rule.item_code = doc.item_code
                    putaway_rule.item_name = doc.item_name
                    putaway_rule.warehouse = material_type.warehouse
                    putaway_rule.priority = 1
                    putaway_rule.company = material_type.company
                    putaway_rule.capacity = material_type.capacity or 50
                    putaway_rule.stock_uom = doc.stock_uom
                    putaway_rule.disable = 0
                    
                    # Add shelf field if it exists in Material Types
                    if hasattr(material_type, 'shelf') and material_type.shelf:
                        putaway_rule.shelf = material_type.shelf
                    
                    putaway_rule.insert(ignore_permissions=True)
                    
                    putaway_link = frappe.utils.get_link_to_form("Putaway Rule", putaway_rule.name)
                    frappe.msgprint(
                        f"Putaway Rule created for Item {doc.item_code} in Warehouse {material_type.warehouse}. {putaway_link}",
                        alert=True
                    )
                else:
                    frappe.msgprint(
                        f"Putaway Rule already exists for Item {doc.item_code} in Warehouse {material_type.warehouse}",
                        alert=True
                    )
            elif material_type.is_putaway_configuration and not material_type.warehouse:
                frappe.msgprint(
                    f"Putaway Configuration is enabled for Material Type {doc.custom_material_type} but no warehouse is configured",
                    alert=True
                )
                
        except Exception as e:
            frappe.log_error(
                f"Error creating Putaway Rule for Item {doc.item_code}: {str(e)}",
                "Putaway Rule Creation Error"
            )
            frappe.msgprint(
                f"Error creating Putaway Rule: {str(e)}",
                alert=True
            )

def update_putaway_rule_on_material_type_change(doc, method):
    """
    Update Putaway Rule when custom_material_type is changed
    """
    if method == "on_update" and doc.has_value_changed("custom_material_type"):
        try:    
            if doc.custom_material_type:
                # Get new Material Types record
                material_type = frappe.get_doc("Material Types", doc.custom_material_type)
                
                # Only create Putaway Rule if putaway configuration is enabled
                if material_type.is_putaway_configuration and material_type.warehouse:
                    # Check if Putaway Rule already exists for new warehouse
                    existing_rule = frappe.db.exists(
                        "Putaway Rule", 
                        {
                            "item_code": doc.item_code,
                            "warehouse": material_type.warehouse
                        }
                    )
                    
                    if not existing_rule:
                        # Create new Putaway Rule
                        putaway_rule = frappe.new_doc("Putaway Rule")
                        putaway_rule.item_code = doc.item_code
                        putaway_rule.item_name = doc.item_name
                        putaway_rule.warehouse = material_type.warehouse
                        putaway_rule.priority = 1
                        putaway_rule.company = material_type.company
                        putaway_rule.capacity = material_type.capacity or 50
                        putaway_rule.stock_uom = doc.stock_uom
                        putaway_rule.disable = 0
                        
                        # Add shelf field if it exists in Material Types
                        if hasattr(material_type, 'shelf') and material_type.shelf:
                            putaway_rule.shelf = material_type.shelf
                        
                        putaway_rule.insert(ignore_permissions=True)
                        
                        putaway_link = frappe.utils.get_link_to_form("Putaway Rule", putaway_rule.name)
                        frappe.msgprint(
                            f"New Putaway Rule created for Item {doc.item_code} in Warehouse {material_type.warehouse}. {putaway_link}",
                            alert=True
                        )
                    else:
                        frappe.msgprint(
                            f"Putaway Rule already exists for Item {doc.item_code} in Warehouse {material_type.warehouse}",
                            alert=True
                        )
                elif material_type.is_putaway_configuration and not material_type.warehouse:
                    frappe.msgprint(
                        f"Putaway Configuration is enabled for Material Type {doc.custom_material_type} but no warehouse is configured",
                        alert=True
                    )
                    
        except Exception as e:
            frappe.log_error(
                f"Error updating Putaway Rule for Item {doc.item_code}: {str(e)}",
                "Putaway Rule Update Error"
            )
            frappe.msgprint(
                f"Error updating Putaway Rule: {str(e)}",
                alert=True
            )