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

        let len = frm.doc.custom_item_charges_template.length

        if(frm.doc.custom_material_type != undefined && len == 0){
            get_item_wise_charges(frm)
        }
    },
    custom_material_type: function (frm) {
        get_item_wise_charges(frm)
    },
    item_group:function(frm){
        get_item_wise_charges_in_item(frm)
    }
})


function get_item_wise_charges(frm){
    frappe.call({
        method: "cn_exim.config.py.item.get_item_charges",
        args: {
            name: frm.doc.custom_material_type
        },
        callback: function (response) {
            let data = response.message
            frm.set_value("custom_item_charge", data[0]['item_charges'])

            data.forEach(obj => {
                let row = frm.add_child("custom_item_charges_template")
                row.type = obj.type;
                row.account_head = obj.account_head;
                row.amount = obj.amount;
                row.description = obj.description;
                row.reference_row = obj.reference_row;
            })
            frm.refresh_field("custom_item_charges_template")
        }
    })
}

function get_item_wise_charges_in_item(frm){
    frappe.call({
        method: "cn_exim.config.py.item.get_item_charges_from_item_group",
        args: {
            name: frm.doc.item_group
        },
        callback: function (response) {
            let data = response.message
            frm.set_value("custom_item_charge", data[0]['custom_item_charge'])

            data.forEach(obj => {
                let row = frm.add_child("custom_item_charges_template")
                row.type = obj.type;
                row.account_head = obj.account_head;
                row.amount = obj.amount;
                row.description = obj.description;
                row.reference_row = obj.reference_row;
            })
            frm.refresh_field("custom_item_charges_template")
        }
    })
}