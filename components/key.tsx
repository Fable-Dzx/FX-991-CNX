import React from "react";
import styles from "../styles/key.module.scss";

interface KeyProps {
    role: "ksys" | "kfunc" | "kfuncr1" | "kbasic" | "kbasicy";
    content?: any;
    upperContent?: any;
    topContent?: any;
    lowerContent?: any;
    onClick: () => void;
}

export default class Key extends React.Component<KeyProps> {
    constructor(props: KeyProps) {
        super(props);
    }

    render = () => (
        <div
            role={this.props.role}
            className={styles.divKeyWrapper}
            onClick={() => this.props.onClick()}>
            <div>{this.props.upperContent}</div>

            <div className={styles.divTopContent}>{this.props.topContent}</div>

            <div>{this.props.content}</div>

            <div className={styles.divLowerContent}>{this.props.lowerContent}</div>
        </div>
    );
}
