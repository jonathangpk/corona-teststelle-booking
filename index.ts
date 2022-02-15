import moment from 'moment'
import pt from 'puppeteer'
import { personalInformation, PersonalInformation } from './personal-information'


const testStations = {
    deutschesMuseum: 'https://www.corona-teststelle.de/standorte/muenchen-deutsches-museum',
    verkehrsZentrum: 'https://www.corona-teststelle.de/standorte/verkehrszentrum-deutsches-museum',
    heidhausen: 'https://www.corona-teststelle.de/standorte/muenchen-haidhausen',
    ramersdorf: 'https://www.corona-teststelle.de/standorte/muenchen-ramersdorf',
    neuperlach: 'https://www.corona-teststelle.de/standorte/muenchen-neuperlach',
}
enum TestReason {
    coronaWarnApp, // not existing anymore due to goverment policy, leaving here since it could come back
    contactPerson,
}

const config = {
    from: '11:00', // HH:mm
    to: '14:00', // HH:mm
    day: '2021-12-24', // YYYY-MM-DD
    test: 'pcr', // Only pcr supported
    testStation: testStations.deutschesMuseum,
    testReason: TestReason.contactPerson,
    refreshInterval: 60, // seconds
    showBrowserUI: true,
}
type Config = typeof config

async function findAsync<T>(array: T[], predicate: (e: T) => Promise<boolean>) {
    let results = array.map(async e => {
        let res = await predicate(e)
        return res ? e : undefined
    })
    return (await Promise.all(results)).find(Boolean)
}

async function wait(s: number) {
    return new Promise(resolve => setTimeout(resolve, s * 1000))
}


async function tryBooking(page: pt.Page, config: Config, personalInformation: PersonalInformation): Promise<boolean> {
    await page.goto(config.testStation, {
        waitUntil: 'networkidle2',
    });

    // Find day
    const days = await page.$$('#termin-kalender > div.days > div > a')
    const day = await findAsync(days, async (day) => {
        var date = await day.evaluate(e => {
            const pad = (num: string | number, i: number) => (Array(i).fill('0').join('') + num).slice(-i)
            const year = e.getAttribute('data-year')
            const month = pad(e.getAttribute('data-month') || '', 2)
            const day = pad(e.getAttribute('data-day') || '', 2)
            console.log(`${year}-${month}-${day}`)
            return `${year}-${month}-${day}`
        })
        return date === config.day;
    })
    if (day === undefined) {
        throw new Error(`Day ${config.day} not found, make sure to follow the YYYY-MM-DD format. If the day in the current month, there is no support for this so far.`)
    }
    let active = await day.evaluate(e => e.parentElement?.classList.contains('active'))
    if (!active) {
        console.log('No appointments available rn')
        return false
    }
    console.log('Appointment available at ' + config.day)
    
    await day.click()
    await page.waitForNetworkIdle()

    // Select appointment time
    const startTime = moment(config.from,'h:mm')
    const endTime = moment(config.to,'h:mm')
    const timeSlots = await page.$$('select#jform_uhrzeit option')
    const timeSlotValues = await Promise.all(timeSlots.map(async (timeSlot) => {
        return timeSlot.evaluate(e => e.getAttribute('value'))
    }))
    let timeSlot = timeSlotValues.find(timeSlot => {
        let time = moment(timeSlot, 'h:mm')
        return time.isSameOrAfter(startTime) && time.isSameOrBefore(endTime)
    })
    if (!timeSlot) {
        console.log('No time slot available within the given time range ' + config.from + ' - ' + config.to)
        return false
    } 
    await page.select('#jform_uhrzeit', timeSlot)

    // Fill out personal information
    await page.type('input#jform_vorname', personalInformation.firstName)
    await page.type('input#jform_nachname', personalInformation.lastName)
    await page.type('input#jform_email', personalInformation.email)
    await page.type('input#jform_titel', personalInformation.title)
    await page.select('select#jform_geschlecht', personalInformation.gender)
    await page.type('input#jform_geburtstag', personalInformation.birthDate.replace('.', ''))
    await page.type('input#jform_ausweisnummer', personalInformation.IDNumber)
    await page.type('input#jform_strasse', personalInformation.street)
    await page.type('input#jform_nr', personalInformation.streetNumber)
    await page.type('input#jform_plz', personalInformation.zip)
    await page.type('input#jform_ort', personalInformation.city)
    await page.type('input#jform_zusatz', personalInformation.additionalAddress)
    await page.type('input#jform_telefon', personalInformation.telefon)
    await page.type('input#jform_mobil', personalInformation.mobile)
    await page.type('input#jform_telefon_geschaeftlich', personalInformation.businnesNumber)
    await page.type('input#jform_fax', personalInformation.fax)
    await page.type('textarea#jform_bemerkungen', personalInformation.comment)

    if (config.testReason === TestReason.coronaWarnApp) {
        await page.click('#jform_params_frage40_label')
        await wait(0.5)
        await page.click('#jform_params_frage40_6_label')
        await wait(0.5)
    } else if (config.testReason == TestReason.contactPerson) {
        await page.click('#jform_params_frage40_label')
        await wait(0.5)
        await page.click('#jform_params_frage40_1_label')
        await wait(0.5)
    } else {
        throw new Error('Test Reason is not yet supported')
    }
    await page.click('#jform_coronawarnapp_label') // allows sending QR code to CWA
    if(!(await page.$('#buchungsform > div > div:nth-child(1) > button.btn-submit'))) {
        return false
    }

    // Submit form
    await page.click('#buchungsform > div > div:nth-child(1) > button.btn-submit')
    await page.waitForNetworkIdle()
    return true
}

async function main() {
    const browser = await pt.launch({ headless: !config.showBrowserUI });
    const page = await browser.newPage();
    while(!(await tryBooking(page, config, personalInformation))) {
        console.log(`waiting ${config.refreshInterval} seconds`)
        await wait(config.refreshInterval)
    }
    console.log('done')
}

main()
