frappe.ui.form.on('Payment Entry', {
    custom_is_advance: function(frm) {
        if (frm.doc.custom_is_advance) {
            // Ensure that the party field is filled and the party type is 'Supplier'
            if (frm.doc.party) {
                // Fetch the complete supplier details
                frappe.db.get_doc('Supplier', frm.doc.party).then((doc) => {
                    // Log the entire supplier document to the console
                    console.log(doc);

                    // Iterate through the accounts table and log advance_account field
                    if (doc.accounts) {
                        doc.accounts.forEach((account) => {
                            console.log(account.advance_account);
                        });
                    }

                    // Check if advance account exists in the first row and set it to gl_indicator field
                    if (doc.accounts && doc.accounts.length > 0 && doc.accounts[0].advance_account) {
                        frm.set_value('custom_gl_indicator', doc.accounts[0].advance_account);
                    }
                });
            }
        }
    },

    custom_gl_indicator: function(frm) {
        // Fetch the value of custom_gl_indicator and set it to paid_from field
        if (frm.doc.custom_gl_indicator) {
            frm.set_value('paid_to', frm.doc.custom_gl_indicator);
        }
    }
});
