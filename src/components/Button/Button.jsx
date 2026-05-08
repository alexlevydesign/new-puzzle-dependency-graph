import "./Button.css"

function Button({label, icon, onClick}) {

    return (

        <button className="button" onClick={onClick}>
            <p>{label}</p>
            <img src={`/icons/${icon}.svg`}/>
            
        </button>

    );


};

export default Button;