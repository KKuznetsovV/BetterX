import './Layout.css'
import Header from '../header/header'
import Follows from '../../../follows/Follows'
import Main from '../main/main'
import Footer from '../footer/footer'

export default function Layout() {
    return (
        <div className="layout">
            <header>
                <Header />
            </header>
            <aside id="follows">
                <Follows />
            </aside>
            <main>
                <Main />
            </main>
            <footer>
                <Footer />
            </footer>
        </div>
    )
}