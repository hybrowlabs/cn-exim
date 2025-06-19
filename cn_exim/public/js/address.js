frappe.ui.form.on("Address", {
    refresh:function(frm){
        var link_doctype = ""
        frm.doc.links.forEach(item => {
            link_doctype = item.link_doctype
        })
        if(link_doctype != "Supplier"){
            frm.toggle_display("custom_vendor_code", false)
        }
    }
})