import "./Button.css"

function Button({ label, icon, onClick, variant = "primary", disabled = false, active = false }) {
    const variantClass = `button--${variant}`;
    const activeClass = active ? 'button--active' : '';
    
    return (
        <button 
            className={`button ${variantClass} ${activeClass}`} 
            onClick={onClick}
            disabled={disabled}
        >
            {label && <span className="button-label">{label}</span>}
            {icon && <img src={`/icons/${icon}.svg`} alt={label || ""} />}
        </button>
    );
}

export default Button;