// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Material Types", {
	// item_charges:function(frm) {
    //     frappe.call({
    //         method:"cn_exim.cn_exim.doctype.material_types.material_types.get_Charges_of_item",
    //         args:{
    //             name:frm.doc.item_charges
    //         },
    //         callback:function(response){
    //             let data = response.message

    //             data.forEach(obj =>{
    //                 let row = frm.add_child("item_charges_template")
    //                 row.type = obj.type;
    //                 row.account_head = obj.account_head;
    //                 row.amount = obj.amount;
    //                 row.description = obj.description;
    //                 row.reference_row = obj.reference_row;
    //             })
    //             frm.refresh_field("item_charges_template")
    //         }
    //     })
	// },
    onload: function(frm) {
        frm.fields_dict["material_type_account"].grid.get_field("default_inventory_account").get_query = function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    company: row.company,
                    is_group: 0,
                    account_type: "Stock"
                }
            };
        };

        frm.fields_dict["material_type_account"].grid.get_field("stock_received_but_not_billed").get_query = function (doc, cdt, cdn) {
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

        // Add warehouse filter to shelf field
        frm.get_field("shelf").get_query = function(doc) {
            return {
                filters: {
                    warehouse: doc.warehouse
                }
            };
        };

    },
    
    warehouse: function(frm) {
        // Clear shelf field when warehouse changes
        frm.set_value("shelf", "");
        frm.refresh_field("shelf");
    }
    
});

