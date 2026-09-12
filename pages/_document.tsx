import Document, {
    Html,
    Head,
    Main,
    NextScript,
    DocumentContext
} from "next/document";

class MyDocument extends Document {
    static async getInitialProps(ctx: DocumentContext) {
        const initialProps = await Document.getInitialProps(ctx);
        return { ...initialProps };
    }

    render() {
        return (
            <Html>
                {/*This Head element affects all pages.*/}
                <Head>
                    {/* The viewport meta lives in _app.tsx so it overrides
                        Next.js' built-in default viewport. */}
                    <meta name="theme-color" content="#eaecf3" />
                    <meta name="description" content="FX-991CN X Online Scientific Calculator (Casio-style CLASSWIZ)" />
                    <link rel="icon" href="/FX-991-CNX/favicon.ico" />
                    <link
                        rel="manifest"
                        href="/FX-991-CNX/manifest.json"></link>
                    <meta name="apple-mobile-web-app-capable" content="yes" />
                    <meta name="apple-mobile-web-app-title" content="FX-991CN X" />
                    <link
                        href="https://fonts.googleapis.com/css2?family=Ubuntu&display=swap"
                        rel="stylesheet"></link>
                </Head>
                <body
                    style={{
                        margin: 0,
                        backgroundColor: "#eaecf3",
                        overscrollBehavior: "none"
                    }}>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
