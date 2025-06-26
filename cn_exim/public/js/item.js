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

        // let len = frm.doc.custom_item_charges_template.length

        // if(frm.doc.custom_material_type != undefined && len == 0){
        //     get_item_wise_charges(frm)
        // }
    },
    // custom_material_type: function (frm) {
    //     get_item_wise_charges(frm)
    // },
    // item_group:function(frm){
    //     get_item_wise_charges_in_item(frm)
    // }
    custom_material_type: function (frm) {
        frappe.call({
            method: "cn_exim.config.py.item.get_default_account",
            args: {
                name: frm.doc.custom_material_type
            },
            callback: function (response) {
                let data = response.message

                data.forEach(obj => {
                    let found = false;

                    // Check if the company already exists in the child table
                    frm.doc.item_defaults.forEach(row => {
                        if (obj.company === row.company) {
                            row.custom_stock_received_but_not_billed = obj.stock_received_but_not_billed;
                            row.custom_default_inventory_account = obj.default_inventory_account;
                            row.expense_account = obj.default_inventory_account;
                            found = true;  // Mark as found
                        }
                    });

                    // If no matching company was found, create a new row
                    if (!found || frm.doc.item_defaults.length === 0) {
                        let new_row = frm.add_child("item_defaults");
                        new_row.company = obj.company;
                        new_row.custom_stock_received_but_not_billed = obj.stock_received_but_not_billed;
                        new_row.custom_default_inventory_account = obj.default_inventory_account;
                        new_row.expense_account = obj.default_inventory_account;
                    }
                });

                // Refresh child table after updates
                frm.refresh_field("item_defaults");

            }
        })
    },
    custom_total_shelf_life_in_month: function (frm) {
        if (frm.doc.custom_shelf_life_uom == "Month") {
            shelf_life_in_day = parseInt(frm.doc.custom_total_shelf_life_in_month) * 30
            frm.set_value("shelf_life_in_days", shelf_life_in_day)
        }
    },
    custom_minimum_shelf_life_in_month: function (frm) {
        if (frm.doc.custom_shelf_life_uom == "Month") {
            minimum_shelf_life_in_day = parseInt(frm.doc.custom_minimum_shelf_life_in_month) * 30
            frm.set_value("custom_minimum_shelf_life", minimum_shelf_life_in_day)
        }
    }
})

frappe.ui.form.on("Item Default", {
    custom_key: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        let material_type = frm.doc.item_group; // Properly declared

        if (material_type) {
            frappe.call({
                method: "cn_exim.config.py.item.get_default_account_form_key_based_on_material_type",
                args: {
                    name: material_type,
                    account_key: row.custom_key,
                    company: row.company
                },
                callback: function (response) {
                    if (response.message) {
                        let data = response.message;

                        data.forEach(obj => {
                            row.custom_stock_received_but_not_billed = obj.stock_received_but_not_billed;
                            row.custom_default_inventory_account = obj.default_inventory_account;
                            row.expense_account = obj.default_expense_account;
                        });
                        frm.refresh_field("item_defaults");
                    }
                }
            });
        }
        else{
            frappe.msgprint("Material type is not set!");
        }
    }
});



// function get_item_wise_charges(frm){
//     frappe.call({
//         method: "cn_exim.config.py.item.get_item_charges",
//         args: {
//             name: frm.doc.custom_material_type
//         },
//         callback: function (response) {
//             let data = response.message
//             frm.set_value("custom_item_charge", data[0]['item_charges'])

//             data.forEach(obj => {
//                 let row = frm.add_child("custom_item_charges_template")
//                 row.type = obj.type;
//                 row.account_head = obj.account_head;
//                 row.amount = obj.amount;
//                 row.description = obj.description;
//                 row.reference_row = obj.reference_row;
//             })
//             frm.refresh_field("custom_item_charges_template")
//         }
//     })
// }

// function get_item_wise_charges_in_item(frm){
//     frappe.call({
//         method: "cn_exim.config.py.item.get_item_charges_from_item_group",
//         args: {
//             name: frm.doc.item_group
//         },
//         callback: function (response) {
//             let data = response.message
//             frm.set_value("custom_item_charge", data[0]['custom_item_charge'])

//             data.forEach(obj => {
//                 let row = frm.add_child("custom_item_charges_template")
//                 row.type = obj.type;
//                 row.account_head = obj.account_head;
//                 row.amount = obj.amount;
//                 row.description = obj.description;
//                 row.reference_row = obj.reference_row;
//             })
//             frm.refresh_field("custom_item_charges_template")
//         }
//     })
// }