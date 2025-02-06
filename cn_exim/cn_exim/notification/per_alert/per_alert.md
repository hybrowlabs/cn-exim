<h3>Hello,</h3>

<p>This is a system-generated request for your review and approval.</p>

<h4>Document Details:</h4>
<ul>
    <li>Doc Name: {{ doc.name }}</li>
    <li>Doc Date: {{ doc.creation }}</li>
    <li>Submitted By: {{ doc.owner }}</li>
</ul>
<p>Document Type: Pre-Alert</p>
<p>Please review the document thoroughly. If all details are correct, kindly approve it from your side.</p>

<p>Document Link: [Click here to review](http://localhost:8000/app/pre-alert/{{ doc.name }})</p>

<p>Your prompt attention and approval will be greatly appreciated.</p>

<h4>Thank you,</h4>
<h4>{{ frappe.session.user }}</h4>
