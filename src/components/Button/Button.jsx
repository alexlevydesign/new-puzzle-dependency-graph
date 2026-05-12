import "./Button.css"

function Button({ label, icon, onClick, variant = "primary", disabled = false }) {
    const variantClass = `button--${variant}`;
    
    return (
        <button 
            className={`button ${variantClass}`} 
            onClick={onClick}
            disabled={disabled}
        >
            {label && <span className="button-label">{label}</span>}
            {icon && <img src={`/icons/${icon}.svg`} alt={label || ""} />}
        </button>
    );
}

export default Button;