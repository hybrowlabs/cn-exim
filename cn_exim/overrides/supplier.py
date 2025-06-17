

import frappe
import json
from frappe import _

@frappe.whitelist(allow_guest=True)
def create_contact(contacts, supplier):
    try:
        if isinstance(contacts, str):
            contacts = json.loads(contacts)

        if not contacts:
            frappe.throw(_("No contact data received"))

        frappe.db.begin()
        created_count = 0

        for contact in contacts:
            contact_doc = frappe.new_doc("Contact")
            contact_doc.flags.ignore_permissions = True
            contact_doc.flags.ignore_links = True
            contact_doc.flags.ignore_mandatory = True

            full_name = str(contact.get("full_name") or "").strip()
            name_parts = full_name.split()

            contact_doc.first_name = name_parts[0] if len(name_parts) > 0 else ""
            contact_doc.middle_name = name_parts[1] if len(name_parts) > 1 else ""
            contact_doc.last_name = " ".join(name_parts[2:]) if len(name_parts) > 2 else ""

            contact_doc.designation = str(contact.get("designation") or "").strip()
            contact_doc.whatsapp_id = None
            contact_doc.is_whatsapp_registered = 0

            if contact.get("email"):
                contact_doc.append("email_ids", {
                    "email_id": str(contact.get("email")).strip(),
                    "is_primary": 1
                })

            if contact.get("mobile_no"):
                contact_doc.append("phone_nos", {
                    "phone": str(contact.get("mobile_no")).strip(),
                    "is_primary_mobile_no": 1
                })

            if supplier:
                contact_doc.append("links", {
                    "link_doctype": "Supplier",
                    "link_name": str(supplier).strip()
                })

            contact_doc.insert(ignore_permissions=True, ignore_mandatory=True)
            created_count += 1

        frappe.db.commit()

        return frappe._dict({
            "message": _("Contacts created successfully"),
            "created": created_count  
        })

    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(frappe.get_traceback(), "Bulk Contact Creation Error")
        frappe.throw(_("An error occurred while creating contacts: {0}").format(str(e)))



@frappe.whitelist()
def get_primary_contact_raw(supplier):
    return frappe.db.sql("""
        SELECT c.name, c.first_name, c.email_id
        FROM `tabContact` c
        JOIN `tabDynamic Link` dl ON dl.parent = c.name
        WHERE dl.link_doctype = 'Supplier' AND dl.link_name = %s
        ORDER BY c.creation ASC
        LIMIT 1
    """, supplier, as_dict=True)


@frappe.whitelist()
def get_primary_address_raw(supplier):
    return frappe.db.sql("""
        SELECT c.name, c.address_title
        FROM `tabAddress` c
        JOIN `tabDynamic Link` dl ON dl.parent = c.name
        WHERE dl.link_doctype = 'Supplier' AND dl.link_name = %s
        ORDER BY c.creation ASC
        LIMIT 1
    """, (supplier,), as_dict=True)

