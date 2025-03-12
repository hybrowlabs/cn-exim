frappe.ui.form.on("Item", {
    custom_material_type: function (frm) {
        if (frm.doc.custom_material_type != undefined) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    "doctype": "Material Types",
                    filters: {
                        'name': frm.doc.custom_material_type
                    },
                    fields: ['account_refrence']
                },
                callback: function (r) {
                    var account_reference = r.message[0]['account_refrence']
                    frm.set_query("valuation_classes", "custom_plant_details", function () {
                        return {
                            filters: {
                                "account_category_refrence": account_reference
                            }
                        }
                    })
                }
            })
        }
    },
    onload: function (frm) {
        frm.fields_dict["item_defaults"].grid.get_field("custom_default_inventory_account").get_query = function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    company: row.company,
                    is_group: 0,
                    account_type: "Stock"
                }
            };
        };

        frm.fields_dict["item_defaults"].grid.get_field("custom_stock_received_but_not_billed").get_query = function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    company: row.company,
                    is_group: 0,
                    root_type: "Liability",
                    account_type: "Stock Received But Not Billed"
                }
            };
        };
    }
})