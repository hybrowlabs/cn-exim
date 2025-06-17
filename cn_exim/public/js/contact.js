frappe.ui.form.on('Contact', {
    links:function(frm)
    {
            if (frm.doc.links && frm.doc.links.length > 0) {
            $.each(frm.doc.links, function(index, link) {
                if (link.link_doctype === "Supplier") {
                    frm.set_df_property('user', 'hidden', 1);
                    frm.refresh_field('user');
                } else {
                    frm.set_df_property('user', 'hidden', 0);
                    frm.refresh_field('user');
                }
            });            
        }    
    },

    onload:function(frm)
    {
        if (frm.doc.links && frm.doc.links.length > 0) {
            $.each(frm.doc.links, function(index, link) {
                if (link.link_doctype === "Supplier") {
                    frm.set_df_property('user', 'hidden', 1);
                    frm.refresh_field('user');
                } else {
                    frm.set_df_property('user', 'hidden', 0);
                    frm.refresh_field('user');
                }
            });            
        }    

    },
    refresh:function(frm)
    {
        if (frm.doc.links && frm.doc.links.length > 0) {
            $.each(frm.doc.links, function(index, link) {
                if (link.link_doctype === "Supplier") {
                    frm.set_df_property('user', 'hidden', 1);
                    frm.refresh_field('user');
                } else {
                    frm.set_df_property('user', 'hidden', 0);
                    frm.refresh_field('user');
                }
            });            
        }    
    }
});


frappe.ui.form.on('Dynamic Link', {
	link_doctype(frm,cdt, cdn) {
        var d = locals[cdt][cdn];
        if(d.link_doctype === "Supplier") {
            frm.set_df_property('user', 'hidden', 1);
            frm.refresh_field('user');
        }
        else {
            frm.set_df_property('user', 'hidden', 0);
            frm.refresh_field('user');
        }
	}
})
