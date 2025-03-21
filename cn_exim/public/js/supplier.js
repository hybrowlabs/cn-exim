frappe.ui.form.on("Supplier",{
    supplier_group:function(frm){
        if(frm.doc.supplier_group == "Domestic Material"){
            frm.set_value("naming_series", "DM.#######")
        }
        else if(frm.doc.supplier_group == "Domestic Service"){
            frm.set_value("naming_series", "DS.#######")
        }
        else if(frm.doc.supplier_group == "Import Material"){
            frm.set_value("naming_series", "IM.#######")
        }
        else if(frm.doc.supplier_group == "Import Service"){
            frm.set_value("naming_series", "IS.#######")
        }
        else if(frm.doc.supplier_group == "Employee"){
            frm.set_value("naming_series", "DM.#######")
            frm.set_value("is_internal_supplier", 1)
        }
    }
})