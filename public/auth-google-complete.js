const success=document.body.dataset.status==='success'
if(window.opener){window.opener.postMessage({type:'mi-tune:google-auth-complete',success},location.origin);window.close()}
else{location.replace(success?'/':'/login?google=failed')}
