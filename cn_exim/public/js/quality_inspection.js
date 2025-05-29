frappe.ui.form.on('Quality Inspection', {
    onload: function (frm) {
        console.log(frm.doc.custom_accepted_quantity)
        if (frm.doc.custom_accepted_quantity == undefined || frm.doc.custom_accepted_quantity == 0) {
            frappe.call({
                method: "cn_exim.config.py.quality_inspection.set_value_in_qc_base_on_pr",
                args: {
                    "parent": frm.doc.reference_name,
                    "item_code": frm.doc.item_code,
                    "name": frm.doc.name
                },
                callback: function (r) {
                }
            })
        }
    },
    custom_rejected_quantity: function (frm) {
        frappe.call({
            method: "cn_exim.config.py.quality_inspection.get_qty_from_purchase_receipt",
            args: {
                "parent": frm.doc.reference_name,
                "item_code": frm.doc.item_code,
            },
            callback: function (r) {
                if (r.message) {
                    if (r.message[0]['qty'] < frm.doc.custom_rejected_quantity) {
                        frappe.throw(__("Rejected quantity cannot be greater than Purchase Receipt quantity."))
                        frm.set_value("custom_rejected_quantity", 0);
                    }
                    else {
                        let accepted_qty = r.message[0]['qty'] - frm.doc.custom_rejected_quantity;
                        frm.set_value("custom_accepted_quantity", accepted_qty)
                    }
                }
            }
        })
    },
    before_save: function (frm) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: "cn_exim.config.py.quality_inspection.get_qty_from_purchase_receipt",
                args: {
                    parent: frm.doc.reference_name,
                    item_code: frm.doc.item_code
                },
                callback: function (r) {
                    if (r.message) {
                        if (r.message[0]['qty'] < frm.doc.custom_rejected_quantity) {
                            frappe.msgprint("❌ Rejected quantity cannot be greater than Purchase Receipt quantity.");
                            frm.set_value("custom_rejected_quantity", 0);
                            reject(); // Cancel save
                        } else {
                            resolve(); // Allow save
                        }
                    } else {
                        resolve(); // If nothing returned, allow save
                    }
                }
            });
        });
    },
    on_submit: function (frm) {
        frappe.call({
            method: "cn_exim.config.py.quality_inspection.update_purchase_receipt",
            args: {
                "parent": frm.doc.reference_name,
                "item_code": frm.doc.item_code,
                "accepted_qty": frm.doc.custom_accepted_quantity,
                "rejected_qty": frm.doc.custom_rejected_quantity
            },
            callback: function (r) {
                if (r.message) {
                    frappe.msgprint("✅ Purchase Receipt updated successfully.");
                }
            }
        });
    }
});