frappe.ui.form.on("Material Request", {

})

frappe.ui.form.on("Material Request Item", {
    item_code:function(frm, cdt, cdn){
        let row = locals[cdt][cdn]
        row.custom_plant = frm.doc.custom_plant
    }
})