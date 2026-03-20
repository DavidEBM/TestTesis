leftToggle.addEventListener("click", () => {

    if(leftPanel.style.left === "0px"){
    
    leftPanel.style.left = "-260px"
    leftToggle.style.left = "0px"
    
    }else{
    
    leftPanel.style.left = "0px"
    leftToggle.style.left = "260px"
    
    }
    
    })

    rightToggle.addEventListener("click", () => {
    
    if(rightPanel.style.right === "0px"){
    
    rightPanel.style.right = "-260px"
    rightToggle.style.right = "0px"
    
    }else{
    
    rightPanel.style.right = "0px"
    rightToggle.style.right = "260px"
    
    }
    
    })