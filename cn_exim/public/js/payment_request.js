frappe.ui.form.on('Payment Request', {
    refresh: function(frm) {
        // Ensure the custom script only runs on Payment Request forms
        if (frm.doc.doctype === 'Payment Request') {
            // Call the updateCustomInWords function when the form is refreshed
            updateCustomInWords(frm);
        }
        // Find the existing 'Create Payment Entry' button and override its behavior
        frm.page.remove_inner_button('Create Payment Entry');

        frm.page.add_inner_button(__('Create Payment Entry'), function() {
            frappe.call({
                method: 'erpnext.accounts.doctype.payment_request.payment_request.make_payment_entry',
                args: {
                    docname: frm.doc.name
                },
                callback: function(response) {
                    var payment_entry = frappe.model.sync(response.message)[0];
                    if (frm.doc.custom_is_advance) {
                        // If is_advance is checked, set is_received to true in Payment Entry
                        payment_entry.custom_is_advance_request = 1;

                        payment_entry.custom_advance_gl_indicator = frm.doc.custom_advance_gl_indicator;

                        payment_entry.paid_to = payment_entry.custom_advance_gl_indicator;
                    }
                    frappe.set_route('Form', payment_entry.doctype, payment_entry.name);
                }
            });
        });
    },
    grand_total: function(frm) {
        // Call the updateCustomInWords function when the grand_total field is changed
        updateCustomInWords(frm);
    },
    custom_is_advance: function(frm) {
        if (frm.doc.custom_is_advance) {
            // Ensure that the party field is filled and the party type is 'Supplier'
            if (frm.doc.party_type === 'Supplier' && frm.doc.party) {
                // Fetch the complete supplier details
                frappe.db.get_doc('Supplier', frm.doc.party).then((doc) => {
                    // Check if advance account exists in the first row and set it to gl_indicator field
                    if (doc.accounts && doc.accounts.length > 0 && doc.accounts[0].advance_account) {
                        frm.set_value('custom_advance_gl_indicator', doc.accounts[0].advance_account);
                    }
                });
            }
        }
    }
});

// Function to update the custom_in_words field
function updateCustomInWords(frm) {
    if (frm.doc.grand_total) {
        // Convert the grand_total value to words
        const inWords = numberToWords(frm.doc.grand_total);
        // Update the custom_in_words field with the converted value
        frm.set_value('custom_in_words', inWords);
    }
}

// Function to convert numbers to words in the Indian numbering system
function numberToWords(amount) {
    const units = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const thousands = ['Thousand', 'Lakh', 'Crore'];

    function convertLessThanThousand(num) {
        let words = '';
        if (num % 100 < 20) {
            words = (num % 100 < 10 ? units[num % 100] : teens[num % 100 - 10]);
            num = Math.floor(num / 100);
        } else {
            words = (num % 10 !== 0 ? units[num % 10] : '');
            num = Math.floor(num / 10);
            words = (tens[num % 10 - 2] + ' ' + words).trim();
            num = Math.floor(num / 10);
        }
        if (num === 0) return words;
        return units[num] + ' Hundred ' + words;
    }

    function convertNumberToWords(num) {
        if (num === 0) return 'Zero';

        const crore = Math.floor(num / 10000000);
        num -= crore * 10000000;

        const lakh = Math.floor(num / 100000);
        num -= lakh * 100000;

        const thousand = Math.floor(num / 1000);
        num -= thousand * 1000;

        const hundred = Math.floor(num / 100);
        num = num % 100;

        let words = '';

        if (crore > 0) words += `${convertLessThanThousand(crore)} Crore `;
        if (lakh > 0) words += `${convertLessThanThousand(lakh)} Lakh `;
        if (thousand > 0) words += `${convertLessThanThousand(thousand)} Thousand `;
        if (hundred > 0) words += `${units[hundred]} Hundred `;
        if (num > 0) words += `${convertLessThanThousand(num)} `;

        return words.trim();
    }

    return convertNumberToWords(Math.floor(amount));
}
