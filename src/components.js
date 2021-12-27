import React from 'react';
import { Nav, Navbar, Spinner, Container } from 'react-bootstrap';
import { A, } from 'hookrouter';

export function MySpinner() {
    return (
        <div className="container vh-100">
            <div className="d-flex align-items-center justify-content-center h-100">
                <Spinner animation="border" role="status" >
                    <span className="sr-only">Loading...</span>
                </Spinner>
            </div>
        </div>
    );
}
export function Header(props) {
    let AuthOptions = CommonAuthOptions;
    if (props.customAuthOptions) {
        AuthOptions = props.customAuthOptions;
    }
    return (
        <Navbar expand="lg" bg="dark" variant="dark" collapseOnSelect="true" >
            <Navbar.Brand>
                {props.children}
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="ml-auto">
                    <Nav.Item><A href="/about" className="nav-link">About</A></Nav.Item>
                    <AuthOptions isAuthenticated={props.isAuthenticated} />
                    {props.navItems.map((navItem, i) => <Nav.Item><A href={navItem.href} className="nav-link">{navItem.text}</A></Nav.Item>)}
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    );
}

function CommonAuthOptions(props) {
    const host = window.location.protocol + "//" + window.location.host;
    if (props.isAuthenticated) {
        return (
            <Nav.Item><a href={process.env.REACT_APP_AUTH_LOGOUT_URL + "?redirect_url=" + host} className="nav-link">Logout</a></Nav.Item>
        );
    } else {
        return (
            [<Nav.Item><a href={process.env.REACT_APP_AUTH_LOGIN_URL + "?redirect_url=" + host} className="nav-link">Login</a></Nav.Item>,
            <Nav.Item><a href={process.env.REACT_APP_AUTH_REGISTER_URL} className="nav-link">Register</a></Nav.Item>]
        )
    }
}
export function NotFound() {
    return (
        <Container className="vh-100">
            <div className="jumbotron d-flex align-items-center justify-content-center h-100">
                <h2>Oops, looks like that page is not available.</h2>
            </div>
        </Container>
    );
}
