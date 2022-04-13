import React from 'react';
import { Form, Button, Row,  Alert, ToggleButton, ButtonGroup } from 'react-bootstrap';

export function InputField(props) {
    const controlProps = {
        type: props.controlType,
        placeholder: props.placeholder ? props.placeholder : "",
        onChange: props.onChange ? props.onChange : null,
        ref: props.inputRef ? props.inputRef : null,
        required: props.required,
    }
    return (
        <Form.Group controlId={props.controlId}>
            <Form.Label>{props.label}</Form.Label>
            <Form.Control {...controlProps} />
        </Form.Group>
    )
}

export function AppshomeForm(props) {
    const handleSubmit = (event) => {
        const form = event.currentTarget;
        if (form.checkValidity() === false) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        event.preventDefault();
        if (props.onSubmit) {
            props.onSubmit();
            return false;
        }
    }

    return (
        <div className="d-flex justify-content-center align-items-center mt-5">
            <div className="col-xs-12 col-md-6" >
                <h2 className="h4 strong">{props.formHeading}</h2>
                <Form onSubmit={handleSubmit}>
                    {props.children}
                </Form>
            </div>
        </div>
    )
}

export function FormActionButtons(props) {
    return (
        <Form.Group as={Row}>
            <Button type="submit"  className="w-25 mr-2">{props.submitCaption}</Button>
            <Button type="button" onClick={props.onCancel} className="w-25">{props.cancelCaption}</Button>
        </Form.Group>
    );
}

export function AlertMessage(props) {
    if (props.alert) {
        setTimeout(props.onAutoClose, 10000)
        return (
            <Alert variant={props.alert.type}>
                {props.alert.message}
            </Alert>
        )
    } else {
        return null;
    }
}
export function RadioGroup(props) {
    return (
        <ButtonGroup toggle>
        {props.radios.map((radio, idx) => (
          <ToggleButton
            key={idx}
            type="radio"
            variant="secondary"
            name={props.radioName}
            value={radio.value}
            checked={props.radioValue === radio.value}
            onChange={(e) => props.setRadioValue(e.currentTarget.value)}
          >
            {radio.name}
          </ToggleButton>
        ))}
      </ButtonGroup>
    )
}