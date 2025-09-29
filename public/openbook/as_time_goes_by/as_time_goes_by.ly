




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts









% this causes the variables to be defined...













% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "As Time Goes By" }
			\fill-line {
				""
				"Lyrics and Music by Herman Hupfeld"
			}
			\fill-line {
				"Ballad"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong

	\partial 8 s8 |

	\myMark "A"
	\startPart
	\repeat volta 2 {
		f2:m7 bes:7 | bes:m6 bes:7 | ees:6 f:m7 | fis:dim7 g:m7 | \myEndLine
		f1:7 | f2:m7 bes:7 |
	} \alternative {
		{
			ees1:maj7 | f2:m7 bes:7 | \myEndLineVoltaNotLast
		}
		{
			ees1:6 | bes2:m7 ees:7 | \myEndLineVoltaLast
		}
	}
	\endPart

	\myMark "B"
	\startPart
	aes1:maj7 | c:7 | f:m | a:dim | \myEndLine
	c2:m aes:7 | f1:7 | bes2:7 bes:dim | bes1:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	f2:m7 bes:7 | bes:m6 bes:7 | ees:6 f:m7 | fis:dim7 g:m7 | \myEndLine
	f1:7 | g2:m7 c:7 | f:m7 bes:7 | ees4:6 des:7 ees:6 \OPC bes:7 | \myEndLine
	\endPart

	\endSong
	\endChords
}



}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Andante" 4 = 76
	\time 4/4
	\key ees \major

	\partial 8 g'8 |

	% part "A"
	\repeat volta 2 {
		aes g f ees f4. g8 | bes aes g f aes4. bes8 | ees d c bes c2 | r2 r4 d |
		f8 ees d c d4 ees | bes bes ees, f |
	} \alternative {
		{
			g1~ | g2 r4 r8 g |
		}
		{
			ees1~ | ees2 r |
		}
	}

	% part "B"
	ees8 f ees c'~ c4 c | c8 des c b c2 | f,8 g f c'~ c4 c | c8 des c b c2 |
	g8 aes g ees'~ ees4 ees | ees8 d ees d f4 d | c c g g | bes2. r8 g |

	% part "A"
	aes g f ees f f4 g8 | bes aes g f aes aes4 bes8 | ees d c bes c2 | r r4 d |
	f8 ees d c d4 ees | bes bes2 g4 | bes2 bes | ees2. r8 g, |
}


 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	You must re -- mem -- ber this
	A kiss is still a kiss
	A sigh is still a sigh
	The fun -- da -- men -- tal things app -- ly
	As Time Goes By __

	% part "A"
	And _

	% part "B"
	Moon -- light and love __ songs- nev -- er out of date
	Hearts full of pas -- __ sion- jea -- lou -- sy and hate
	Wo -- men needs man- __ and man must have his mate
	That no one can de -- ny

	% part "A"
	It's still the same old sto -- ry
	A fight for love and glo -- ry
	A case of do or die
	The world will al -- ways wel -- come lov -- ers
	As Time Goes By
}


}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	





\lyricmode {

	% part "A"
	And when two lov -- ers woo
	They still say: "\"I" love "you\""
	On that you can re -- ly
	No mat -- ter what the fu -- ture brings
	As Time Goes _ _ By __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong

	\partial 8 s8 |

	\myMark "A"
	\startPart
	\repeat volta 2 {
		f2:m7 bes:7 | bes:m6 bes:7 | ees:6 f:m7 | fis:dim7 g:m7 | \myEndLine
		f1:7 | f2:m7 bes:7 |
	} \alternative {
		{
			ees1:maj7 | f2:m7 bes:7 | \myEndLineVoltaNotLast
		}
		{
			ees1:6 | bes2:m7 ees:7 | \myEndLineVoltaLast
		}
	}
	\endPart

	\myMark "B"
	\startPart
	aes1:maj7 | c:7 | f:m | a:dim | \myEndLine
	c2:m aes:7 | f1:7 | bes2:7 bes:dim | bes1:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	f2:m7 bes:7 | bes:m6 bes:7 | ees:6 f:m7 | fis:dim7 g:m7 | \myEndLine
	f1:7 | g2:m7 c:7 | f:m7 bes:7 | ees4:6 des:7 ees:6 \OPC bes:7 | \myEndLine
	\endPart

	\endSong
	\endChords
}




\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Andante" 4 = 76
	\time 4/4
	\key ees \major

	\partial 8 g'8 |

	% part "A"
	\repeat volta 2 {
		aes g f ees f4. g8 | bes aes g f aes4. bes8 | ees d c bes c2 | r2 r4 d |
		f8 ees d c d4 ees | bes bes ees, f |
	} \alternative {
		{
			g1~ | g2 r4 r8 g |
		}
		{
			ees1~ | ees2 r |
		}
	}

	% part "B"
	ees8 f ees c'~ c4 c | c8 des c b c2 | f,8 g f c'~ c4 c | c8 des c b c2 |
	g8 aes g ees'~ ees4 ees | ees8 d ees d f4 d | c c g g | bes2. r8 g |

	% part "A"
	aes g f ees f f4 g8 | bes aes g f aes aes4 bes8 | ees d c bes c2 | r r4 d |
	f8 ees d c d4 ees | bes bes2 g4 | bes2 bes | ees2. r8 g, |
}



}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1931 Harms Incorporated, USA" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:17 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





