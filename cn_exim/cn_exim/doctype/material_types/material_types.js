// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Material Types", {
	item_charges:function(frm) {
        frappe.call({
            method:"cn_exim.cn_exim.doctype.material_types.material_types.get_Charges_of_item",
            args:{
                name:frm.doc.item_charges
            },
            callback:function(response){
                let data = response.message

                data.forEach(obj =>{
                    let row = frm.add_child("item_charges_template")
                    row.type = obj.type;
                    row.account_head = obj.account_head;
                    row.amount = obj.amount;
                    row.description = obj.description;
                    row.reference_row = obj.reference_row;
                })
                frm.refresh_field("item_charges_template")
            }
        })
	},
});
