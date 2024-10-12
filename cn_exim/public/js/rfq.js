frappe.ui.form.on("Request for Quotation", {
    custom_pickup_request:function(frm){
        frappe.call({
            method:"cn_exim.cn_exim.api.get_api_list",
            args:{
                pr:frm.doc.custom_pickup_request
            },
            callback:function(r){
                console.log("###################^78",r.message)

                if(r.message){
                    frm.clear_table("suppliers")
                    frm.clear_table("items")
                    var d = frm.add_child("suppliers");
                    frappe.model.set_value(d.doctype, d.name, 'supplier', r.message[0]);
                    frm.refresh_fields("suppliers")
                    
                    $.each(r.message[1],function(i,m){
                        var child = frm.add_child("items");
                        frappe.model.set_value(child.doctype, child.name, 'item_code', m.item);
                        frappe.model.set_value(child.doctype, child.name, 'qty', m.pick_qty);
                        
                        

                    })




                }
            }


        })
    }
})