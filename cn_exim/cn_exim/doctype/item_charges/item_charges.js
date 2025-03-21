// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Item Charges", {
	refresh(frm) {
        frm.set_query("account_head", "item_charges_template", function(){
            return{
                filters:{
                    company:frm.doc.company
                }
            }
        })
	},
});
